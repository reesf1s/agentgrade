import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { isIssueWorkflowState } from "@/lib/review-workflow";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const workflowState =
      typeof body.workflow_state === "string" ? body.workflow_state : undefined;
    if (workflowState !== undefined && !isIssueWorkflowState(workflowState)) {
      return NextResponse.json({ error: "Invalid workflow state" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const resolvedFromWorkflow = workflowState === "resolved";
    const isResolved =
      typeof body.is_resolved === "boolean" ? body.is_resolved : resolvedFromWorkflow;
    if (workflowState === undefined && typeof body.is_resolved !== "boolean") {
      return NextResponse.json({ error: "No workflow update provided" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      ...(workflowState
        ? {
            workflow_state: workflowState,
            workflow_updated_at: now,
          }
        : {}),
      ...(typeof isResolved === "boolean"
        ? {
            is_resolved: isResolved,
            resolved_at: isResolved ? now : null,
          }
        : {}),
    };

    const { data, error } = await supabaseAdmin
      .from("ag_failure_patterns")
      .update(updatePayload)
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update pattern" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Pattern PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
