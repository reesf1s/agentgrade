import { redirect } from "next/navigation";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
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
    redirect("/onboarding");
  }

  const report = await loadReportData(workspaceContext.workspace.id);
  return <ReportsPageClient report={report} />;
}
