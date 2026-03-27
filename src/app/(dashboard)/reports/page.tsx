import { redirect } from "next/navigation";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { SetupEmptyState } from "@/components/dashboard/setup-empty-state";
import { loadReportData } from "@/lib/dashboard-data";
import { getUserId } from "@/lib/auth/get-user";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function ReportsPage() {
  const userId = await getUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext?.workspace.id) {
    return (
      <SetupEmptyState
        title="Reports unlock after setup"
        description="Weekly reports only become meaningful once AgentGrade is receiving real conversations from at least one connected bot. Connect a bot and push a sample transcript to start generating reports."
      />
    );
  }

  const report = await loadReportData(workspaceContext.workspace.id);
  return <ReportsPageClient report={report} />;
}
