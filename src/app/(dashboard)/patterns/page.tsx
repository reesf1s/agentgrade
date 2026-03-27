import { redirect } from "next/navigation";
import { PatternsPageClient } from "@/components/dashboard/patterns-page-client";
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
    redirect("/onboarding");
  }

  const patterns = await loadPatternsData(workspaceContext.workspace.id);
  return <PatternsPageClient initialPatterns={patterns} />;
}
