import { redirect } from "next/navigation";
import { BenchmarksPageClient } from "@/components/dashboard/benchmarks-page-client";
import { SetupEmptyState } from "@/components/dashboard/setup-empty-state";
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
    return (
      <SetupEmptyState
        title="Benchmarks start once conversations land"
        description="Benchmarks don’t require a finished onboarding flow, but they do require a connected agent and enough scored conversations to compare quality meaningfully."
      />
    );
  }

  const stats = await loadBenchmarkStats(workspaceContext.workspace.id, 30);
  return <BenchmarksPageClient stats={stats} />;
}
