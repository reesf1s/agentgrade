import { redirect } from "next/navigation";
import { BenchmarksPageClient } from "@/components/dashboard/benchmarks-page-client";
import { getCurrentWorkspaceId, loadBenchmarkStats } from "@/lib/dashboard-data";

export default async function BenchmarksPage() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const stats = await loadBenchmarkStats(workspaceId, 30);
    return <BenchmarksPageClient stats={stats} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/sign-in");
    }
    throw error;
  }
}
