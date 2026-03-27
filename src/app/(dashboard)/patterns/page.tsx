import { redirect } from "next/navigation";
import { PatternsPageClient } from "@/components/dashboard/patterns-page-client";
import { getCurrentWorkspaceId, loadPatternsData } from "@/lib/dashboard-data";

export default async function PatternsPage() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const patterns = await loadPatternsData(workspaceId);
    return <PatternsPageClient initialPatterns={patterns} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/sign-in");
    }
    throw error;
  }
}
