import type { FailurePattern } from "@/lib/db/types";

function severityRank(severity: FailurePattern["severity"]): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractQuotedValue(value: string): string | null {
  const match = value.match(/"([^"]+)"/);
  return match?.[1] ?? null;
}

function extractResolutionType(pattern: FailurePattern): string | null {
  const fromTitle = pattern.title.match(/^Resolution failure in (.+?) conversations/i);
  if (fromTitle?.[1]) {
    return fromTitle[1].trim();
  }

  const fromDescription = pattern.description.match(/Create step-by-step resolution procedures for (.+?) issues/i);
  return fromDescription?.[1]?.trim() ?? null;
}

function extractScoreDimension(pattern: FailurePattern): string | null {
  const fromTitle = pattern.title.match(/^(.+?) score dropped/i);
  return fromTitle?.[1]?.trim().toLowerCase() ?? null;
}

export function getPatternFingerprint(pattern: FailurePattern): string {
  switch (pattern.pattern_type) {
    case "tone_drift":
      return "tone_drift";
    case "escalation_trigger":
      return "escalation_trigger";
    case "hallucination_cluster": {
      const topic = extractQuotedValue(pattern.description) || extractQuotedValue(pattern.title);
      return `hallucination_cluster:${slugify(topic || "general")}`;
    }
    case "topic_cluster": {
      const topic = extractQuotedValue(pattern.title) || extractQuotedValue(pattern.description);
      return `topic_cluster:${slugify(topic || "general")}`;
    }
    case "resolution_failure": {
      const type = extractResolutionType(pattern);
      return `resolution_failure:${slugify(type || "general")}`;
    }
    case "score_anomaly": {
      const dimension = extractScoreDimension(pattern);
      return `score_anomaly:${slugify(dimension || "overall")}`;
    }
    default:
      return `${pattern.pattern_type}:${slugify(pattern.title)}`;
  }
}

function summarizeDuplicateEvidence(patterns: FailurePattern[]): string | null {
  if (patterns.length <= 1) return null;

  if (patterns[0]?.pattern_type === "tone_drift") {
    const recentAverages = patterns
      .map((pattern) => pattern.description.match(/recent avg: (\d+)%/i)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number)
      .sort((a, b) => a - b);

    const earlyAverage = patterns[0]?.description.match(/Early avg: (\d+)%/i)?.[1];
    if (recentAverages.length > 0) {
      const low = recentAverages[0];
      const high = recentAverages[recentAverages.length - 1];
      return `Observed in ${patterns.length} overlapping analyses. Early average was ${earlyAverage || "higher"}%, while recent tone clustered between ${low}% and ${high}%.`;
    }
  }

  return `Observed in ${patterns.length} overlapping analyses of the same issue.`;
}

function preferredPattern(a: FailurePattern, b: FailurePattern): FailurePattern {
  const severityDelta = severityRank(b.severity) - severityRank(a.severity);
  if (severityDelta !== 0) {
    return severityDelta > 0 ? b : a;
  }

  return new Date(b.detected_at).getTime() > new Date(a.detected_at).getTime() ? b : a;
}

export function mergePatternGroup(patterns: FailurePattern[]): FailurePattern {
  const base = patterns.reduce(preferredPattern);
  const affectedConversationIds = [...new Set(patterns.flatMap((pattern) => pattern.affected_conversation_ids || []))];
  const duplicateSummary = summarizeDuplicateEvidence(patterns);

  let title = base.title;
  let description = base.description;

  if (base.pattern_type === "tone_drift") {
    title = "Tone quality has declined recently";
  } else if (base.pattern_type === "hallucination_cluster") {
    title = "Ungrounded answers are appearing repeatedly";
  } else if (base.pattern_type === "escalation_trigger") {
    title = "Customers are asking for a human too early";
  }

  if (duplicateSummary) {
    description = `${base.description} ${duplicateSummary}`;
  }

  return {
    ...base,
    title,
    description,
    affected_conversation_ids: affectedConversationIds,
  };
}

export function dedupeFailurePatterns(patterns: FailurePattern[]): FailurePattern[] {
  const grouped = new Map<string, FailurePattern[]>();

  for (const pattern of patterns) {
    const fingerprint = getPatternFingerprint(pattern);
    const current = grouped.get(fingerprint) || [];
    current.push(pattern);
    grouped.set(fingerprint, current);
  }

  return [...grouped.values()]
    .map((group) => mergePatternGroup(group))
    .sort((left, right) => {
      const severityDelta = severityRank(right.severity) - severityRank(left.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return new Date(right.detected_at).getTime() - new Date(left.detected_at).getTime();
    });
}
