import { redirect } from "next/navigation";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { getCurrentWorkspaceId, loadReportData } from "@/lib/dashboard-data";

export default async function ReportsPage() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const report = await loadReportData(workspaceId);
    return <ReportsPageClient report={report} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/sign-in");
    }
    throw error;
  }
}
