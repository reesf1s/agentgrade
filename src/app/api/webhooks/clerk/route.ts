import { NextRequest, NextResponse } from "next/server";

/**
 * Clerk webhook for user events.
 * Creates workspace on first sign-up.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.type;

    if (eventType === "user.created") {
      const user = body.data;
      console.log("New user created:", user.id);
      // In production: create workspace and workspace_member in Supabase
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
