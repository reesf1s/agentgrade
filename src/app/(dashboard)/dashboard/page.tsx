import { redirect } from "next/navigation";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { getCurrentWorkspaceId, loadDashboardData } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const data = await loadDashboardData(workspaceId);
    return <DashboardPageClient data={data} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/sign-in");
    }
    throw error;
  }
}
