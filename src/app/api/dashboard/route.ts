import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { loadDashboardData } from "@/lib/dashboard-data";

/**
 * GET /api/dashboard
 * Returns dashboard stats, recent conversations, and active alerts.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const dashboard = await loadDashboardData(workspaceId);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
