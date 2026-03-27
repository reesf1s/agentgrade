import { redirect } from "next/navigation";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { SetupEmptyState } from "@/components/dashboard/setup-empty-state";
import { loadDashboardData } from "@/lib/dashboard-data";
import { getUserId } from "@/lib/auth/get-user";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext?.workspace.id) {
    return (
      <SetupEmptyState
        title="Connect your first agent"
        description="Your dashboard is ready, but there are no connected agents or workspace data available yet. Add a bot, send a sample conversation, and AgentGrade will begin scoring in real time."
      />
    );
  }

  const data = await loadDashboardData(workspaceContext.workspace.id);
  return <DashboardPageClient data={data} />;
}
