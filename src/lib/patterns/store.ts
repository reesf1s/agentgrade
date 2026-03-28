import { supabaseAdmin } from "@/lib/supabase";
import type { FailurePattern } from "@/lib/db/types";
import {
  dedupeFailurePatterns,
  getPatternFingerprint,
  mergePatternGroup,
} from "@/lib/patterns/normalize";

export async function syncFailurePatterns(
  workspaceId: string,
  nextPatterns: FailurePattern[]
): Promise<void> {
  const dedupedNextPatterns = dedupeFailurePatterns(nextPatterns);

  const { data: existingPatterns } = await supabaseAdmin
    .from("failure_patterns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", false);

  const existingByFingerprint = new Map<string, FailurePattern[]>();

  for (const rawPattern of ((existingPatterns || []) as FailurePattern[])) {
    const fingerprint = getPatternFingerprint(rawPattern);
    const current = existingByFingerprint.get(fingerprint) || [];
    current.push(rawPattern);
    existingByFingerprint.set(fingerprint, current);
  }

  const seenFingerprints = new Set<string>();

  for (const pattern of dedupedNextPatterns) {
    const fingerprint = getPatternFingerprint(pattern);
    seenFingerprints.add(fingerprint);
    const existingGroup = existingByFingerprint.get(fingerprint) || [];

    if (existingGroup.length === 0) {
      await supabaseAdmin.from("failure_patterns").insert({
        workspace_id: workspaceId,
        pattern_type: pattern.pattern_type,
        title: pattern.title,
        description: pattern.description,
        affected_conversation_ids: pattern.affected_conversation_ids,
        severity: pattern.severity,
        recommendation: pattern.recommendation,
        prompt_fix: pattern.prompt_fix,
        knowledge_base_suggestion: pattern.knowledge_base_suggestion,
      });
      continue;
    }

    const canonical = mergePatternGroup(existingGroup);
    const primary = existingGroup.find((candidate) => candidate.id === canonical.id) || existingGroup[0];

    await supabaseAdmin
      .from("failure_patterns")
      .update({
        title: pattern.title,
        description: pattern.description,
        affected_conversation_ids: [...new Set([...(primary.affected_conversation_ids || []), ...pattern.affected_conversation_ids])],
        severity: pattern.severity,
        recommendation: pattern.recommendation,
        prompt_fix: pattern.prompt_fix,
        knowledge_base_suggestion: pattern.knowledge_base_suggestion,
        detected_at: new Date().toISOString(),
      })
      .eq("id", primary.id);

    const duplicateIds = existingGroup
      .filter((candidate) => candidate.id !== primary.id)
      .map((candidate) => candidate.id);

    if (duplicateIds.length > 0) {
      await supabaseAdmin
        .from("failure_patterns")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .in("id", duplicateIds);
    }
  }

  const staleFingerprints = [...existingByFingerprint.keys()].filter(
    (fingerprint) => !seenFingerprints.has(fingerprint)
  );

  for (const fingerprint of staleFingerprints) {
    const staleIds = (existingByFingerprint.get(fingerprint) || []).map((pattern) => pattern.id);
    if (staleIds.length === 0) continue;

    await supabaseAdmin
      .from("failure_patterns")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .in("id", staleIds);
  }
}
