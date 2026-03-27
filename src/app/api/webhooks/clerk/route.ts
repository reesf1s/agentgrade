import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createHmac } from "crypto";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 48) +
    "-" +
    Math.random().toString(36).substring(2, 7)
  );
}

/**
 * POST /api/webhooks/clerk
 * Handles Clerk user lifecycle events.
 * On user.created: creates ag_workspace + ag_workspace_member (owner role).
 *
 * Verify webhook signature from Clerk using CLERK_WEBHOOK_SECRET env var.
 * (Set this in Clerk Dashboard > Webhooks > signing secret)
 */
export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    // Verify Clerk webhook signature if secret is configured
    const clerkWebhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (clerkWebhookSecret) {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
      }

      // Svix signature format: v1,<base64-encoded-hmac-sha256>
      const toSign = `${svixId}.${svixTimestamp}.${bodyText}`;
      const hmac = createHmac("sha256", clerkWebhookSecret).update(toSign).digest("base64");
      const expectedSig = `v1,${hmac}`;
      const receivedSigs = svixSignature.split(" ");

      const valid = receivedSigs.some((sig) => sig === expectedSig);
      if (!valid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(bodyText);
    const eventType = body.type;

    if (eventType === "user.created") {
      const user = body.data;
      const firstName = user.first_name || "";
      const lastName = user.last_name || "";
      const email =
        user.email_addresses?.[0]?.email_address || null;
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "My";
      const workspaceName = `${fullName}'s Workspace`;
      const slug = generateSlug(fullName + " workspace");

      // Create workspace
      const { data: workspace, error: wsError } = await supabaseAdmin
        .from("ag_workspaces")
        .insert({
          name: workspaceName,
          slug,
          plan: "starter",
          monthly_conversation_limit: 5000,
        })
        .select("id")
        .single();

      if (wsError || !workspace) {
        console.error("Failed to create workspace:", wsError);
        return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
      }

      // Create owner membership
      const { error: memberError } = await supabaseAdmin
        .from("ag_workspace_members")
        .insert({
          workspace_id: workspace.id,
          clerk_user_id: user.id,
          email,
          role: "owner",
        });

      if (memberError) {
        console.error("Failed to create workspace member:", memberError);
        // Rollback workspace creation
        await supabaseAdmin.from("ag_workspaces").delete().eq("id", workspace.id);
        return NextResponse.json({ error: "Failed to create workspace member" }, { status: 500 });
      }

      // Seed default alert thresholds for the new workspace
      const defaultThresholds = [
        { dimension: "overall", threshold: 0.5 },
        { dimension: "hallucination", threshold: 0.6 },
        { dimension: "accuracy", threshold: 0.6 },
      ];

      await supabaseAdmin.from("ag_alert_configs").insert(
        defaultThresholds.map((t) => ({ workspace_id: workspace.id, ...t }))
      );

      console.log(`Created workspace ${workspace.id} for user ${user.id} (${email})`);
    }

    // Log the event
    // Non-fatal: log event asynchronously
    void supabaseAdmin.from("ag_webhook_events").insert({
      event_source: "clerk",
      event_type: eventType,
      payload: body.data,
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
