import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { loadReportData } from "@/lib/dashboard-data";

/**
 * GET /api/reports
 * Returns the latest weekly report data aggregated from real conversations.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await loadReportData(ctx.workspace.id);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
