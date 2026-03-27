import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/fixes/:id/push
 * Pushes an approved fix to the connected platform.
 *
 * For knowledge_gap fixes: creates/updates an Intercom Knowledge Base article.
 * For prompt_improvement fixes: returns the recommended prompt change as text
 *   (prompt changes must be applied manually in the agent config).
 *
 * Requires: fix.status === 'approved'
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can push fixes" }, { status: 403 });
    }

    const { id } = await params;

    const { data: fix, error: fetchError } = await supabaseAdmin
      .from("ag_suggested_fixes")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !fix) {
      return NextResponse.json({ error: "Fix not found" }, { status: 404 });
    }

    if (fix.status !== "approved") {
      return NextResponse.json(
        { error: `Fix must be approved before pushing. Current status: ${fix.status}` },
        { status: 400 }
      );
    }

    let pushResult: Record<string, unknown>;

    if (fix.fix_type === "knowledge_gap") {
      // Push to Intercom Knowledge Base if connection exists
      pushResult = await pushKnowledgeGapToIntercom(fix, ctx.workspace.id);
    } else {
      // Prompt improvements cannot be auto-pushed — return instructions
      pushResult = {
        type: "prompt_improvement",
        message: "Prompt improvements must be applied manually in your agent configuration.",
        recommended_change: fix.recommended_change,
        current_behavior: fix.current_behavior,
        expected_impact: fix.expected_impact,
        instructions: [
          "1. Open your agent's system prompt in your AI platform (e.g. OpenAI Playground, Anthropic Console)",
          "2. Apply the recommended change below",
          "3. Test the change with sample conversations",
          "4. Deploy the updated prompt to production",
        ],
      };
    }

    // Mark fix as pushed
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("ag_suggested_fixes")
      .update({
        status: "pushed",
        pushed_at: new Date().toISOString(),
        push_result: pushResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to mark fix as pushed:", updateError);
    }

    return NextResponse.json({
      success: true,
      fix: updated || fix,
      push_result: pushResult,
    });
  } catch (error) {
    console.error("Fix push error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Intercom KB push ─────────────────────────────────────────────────────────

async function pushKnowledgeGapToIntercom(
  fix: { title: string; description: string; recommended_change: string },
  workspaceId: string
): Promise<Record<string, unknown>> {
  // Find the Intercom connection for this workspace
  const { data: connections } = await supabaseAdmin
    .from("ag_agent_connections")
    .select("api_key_encrypted, config")
    .eq("workspace_id", workspaceId)
    .eq("platform", "intercom")
    .eq("is_active", true)
    .limit(1);

  const connection = connections?.[0];

  if (!connection?.api_key_encrypted) {
    return {
      type: "knowledge_gap",
      message: "No active Intercom connection with API key found. Article draft returned for manual creation.",
      draft: {
        title: fix.title,
        body: `<h2>${fix.title}</h2>\n<p>${fix.description}</p>\n<h3>Suggested Content</h3>\n<p>${fix.recommended_change}</p>`,
      },
    };
  }

  // Create article in Intercom Help Center
  const articleBody = {
    title: fix.title,
    description: fix.description,
    body: `<h2>${fix.title}</h2>\n<p>${fix.description}</p>\n<h3>Details</h3>\n<p>${fix.recommended_change}</p>`,
    state: "draft", // draft so a human can review before publishing
  };

  try {
    const response = await fetch("https://api.intercom.io/articles", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.api_key_encrypted}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Intercom-Version": "2.10",
      },
      body: JSON.stringify(articleBody),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        type: "knowledge_gap",
        success: false,
        message: `Intercom API error: ${response.status}`,
        error: err,
        draft: articleBody,
      };
    }

    const article = await response.json();

    return {
      type: "knowledge_gap",
      success: true,
      platform: "intercom",
      article_id: article.id,
      article_url: `https://app.intercom.com/a/apps/${(connection.config as { app_id?: string })?.app_id || ""}/articles/${article.id}`,
      message: "Draft article created in Intercom Help Center. Review and publish it to make it live.",
    };
  } catch (err) {
    return {
      type: "knowledge_gap",
      success: false,
      message: `Failed to create Intercom article: ${String(err)}`,
      draft: articleBody,
    };
  }
}
