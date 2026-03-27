import { redirect } from "next/navigation";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
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
    redirect("/onboarding");
  }

  const data = await loadDashboardData(workspaceContext.workspace.id);
  return <DashboardPageClient data={data} />;
}
