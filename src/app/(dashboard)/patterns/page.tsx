import { redirect } from "next/navigation";
import { PatternsPageClient } from "@/components/dashboard/patterns-page-client";
import { SetupEmptyState } from "@/components/dashboard/setup-empty-state";
import { loadPatternsData } from "@/lib/dashboard-data";
import { getUserId } from "@/lib/auth/get-user";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function PatternsPage() {
  const userId = await getUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext?.workspace.id) {
    return (
      <SetupEmptyState
        title="Patterns need scored conversations"
        description="Pattern detection looks for repeated quality failures across your conversations. Once at least one bot is connected and transcripts start flowing in, this view will surface recurring breakdowns and recommended fixes."
      />
    );
  }

  const patterns = await loadPatternsData(workspaceContext.workspace.id);
  return <PatternsPageClient initialPatterns={patterns} />;
}
