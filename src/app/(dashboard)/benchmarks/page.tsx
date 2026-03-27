import { redirect } from "next/navigation";
import { BenchmarksPageClient } from "@/components/dashboard/benchmarks-page-client";
import { loadBenchmarkStats } from "@/lib/dashboard-data";
import { getUserId } from "@/lib/auth/get-user";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function BenchmarksPage() {
  const userId = await getUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext?.workspace.id) {
    redirect("/onboarding");
  }

  const stats = await loadBenchmarkStats(workspaceContext.workspace.id, 30);
  return <BenchmarksPageClient stats={stats} />;
}
