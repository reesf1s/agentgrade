/**
 * Suggested Fix Generator
 *
 * Uses the production LLM stack to generate production-ready fix content for each failure pattern type.
 * Each pattern type gets a specialized prompt tuned to the specific failure mode:
 *
 *   knowledge_gap        → drafts a new KB article
 *   hallucination_cluster → drafts a KB correction article
 *   escalation_trigger   → drafts system prompt improvements
 *   tone_drift           → drafts tone adjustment guidelines
 *   resolution_failure   → drafts resolution playbook
 *   topic_cluster        → drafts KB article or system prompt addition (depending on content)
 *
 * Generated content is stored back into the failure_patterns.prompt_fix and
 * failure_patterns.knowledge_base_suggestion fields.
 */

import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import type { FailurePattern } from "@/lib/db/types";

const FIX_GENERATION_MODEL = process.env.FIX_GENERATION_MODEL || process.env.SCORING_MODEL || "gpt-5.4-mini";

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ─── Fix Generation Prompts ─────────────────────────────────────────
// Each pattern type has a specialized system prompt that produces
// content matching exactly what the agent needs (KB article vs prompt text).

const FIX_SYSTEM_PROMPT = `You are AgentGrade's fix recommendation engine.
You analyze AI agent failure patterns and generate specific, actionable remediation content.
Your output must be immediately usable — not generic advice, but concrete text the user can paste.
Return ONLY valid JSON matching the requested schema.`;

async function generateJson<T>(userMessage: string): Promise<T> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await openai.responses.create({
    model: FIX_GENERATION_MODEL,
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    input: [
      { role: "system", content: FIX_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = response.output_text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in fix generation response: ${text.slice(0, 240)}`);
  }

  return JSON.parse(jsonMatch[0]) as T;
}

// ─── Type Definitions ───────────────────────────────────────────────
export interface GeneratedFix {
  pattern_id: string;
  pattern_type: string;
  prompt_fix: string | null;       // Text to add/modify in the agent system prompt
  kb_article: string | null;       // Draft KB article content (markdown)
  kb_article_title: string | null; // Title for the KB article
  summary: string;                 // One-sentence description of the fix
}

// ─── Fetch Affected Conversation Samples ───────────────────────────
/**
 * Fetches up to 3 of the worst affected conversations to give the model
 * enough context to generate a specific, grounded fix.
 */
async function fetchAffectedSamples(
  affectedConversationIds: string[]
): Promise<{ summary: string; score: number; knowledge_gaps: string[] }[]> {
  if (affectedConversationIds.length === 0) return [];

  const sampleIds = affectedConversationIds.slice(0, 3);

  const { data } = await supabaseAdmin
    .from("quality_scores")
    .select("overall_score, summary, knowledge_gaps")
    .in("conversation_id", sampleIds);

  return (data || []).map((row: {
    overall_score: number;
    summary: string | null;
    knowledge_gaps: unknown;
  }) => ({
    summary: row.summary || "No summary available.",
    score: row.overall_score,
    knowledge_gaps: Array.isArray(row.knowledge_gaps)
      ? (row.knowledge_gaps as { topic?: string }[]).map((g) => g.topic || "").filter(Boolean)
      : [],
  }));
}

// ─── Fix Generators by Pattern Type ────────────────────────────────

async function generateKnowledgeGapFix(
  pattern: FailurePattern,
  samples: ReturnType<typeof fetchAffectedSamples> extends Promise<infer T> ? T : never
): Promise<{ prompt_fix: string | null; kb_article: string; kb_article_title: string; summary: string }> {
  const topicHints = samples.flatMap((s) => s.knowledge_gaps).join(", ");

  const userMessage = `Pattern: ${pattern.title}
Description: ${pattern.description}
Missing topics identified: ${topicHints || "see description"}

Conversation summaries:
${samples.map((s, i) => `${i + 1}. (Score: ${(s.score * 100).toFixed(0)}%) ${s.summary}`).join("\n")}

Generate a knowledge base article that would prevent this gap.

Return JSON:
{
  "kb_article_title": "<article title>",
  "kb_article": "<full article in markdown, 300-600 words, with clear sections>",
  "summary": "<one sentence: what this article covers and why it matters>"
}`;

  const raw = await generateJson<{
    kb_article_title?: string;
    kb_article?: string;
    summary?: string;
  }>(userMessage);

  return {
    prompt_fix: null, // knowledge gaps need KB content, not prompt changes
    kb_article: raw.kb_article || "Article generation failed — manual review needed.",
    kb_article_title: raw.kb_article_title || pattern.title,
    summary: raw.summary || "New KB article to address information gap.",
  };
}

async function generateHallucinationFix(
  pattern: FailurePattern,
  samples: ReturnType<typeof fetchAffectedSamples> extends Promise<infer T> ? T : never
): Promise<{ prompt_fix: string; kb_article: string; kb_article_title: string; summary: string }> {
  const userMessage = `Pattern: ${pattern.title}
Description: ${pattern.description}

Conversation summaries (these conversations had fabricated information):
${samples.map((s, i) => `${i + 1}. (Score: ${(s.score * 100).toFixed(0)}%) ${s.summary}`).join("\n")}

Generate:
1. A correction KB article that provides accurate information to replace what the agent was fabricating
2. A system prompt addition that prevents the agent from making this type of mistake

Return JSON:
{
  "kb_article_title": "<title for the correction article>",
  "kb_article": "<corrective article with accurate facts, 200-400 words, markdown>",
  "prompt_fix": "<exact text to add to system prompt — be specific, 50-150 words>",
  "summary": "<one sentence: what was being fabricated and how this fix addresses it>"
}`;

  const raw = await generateJson<{
    kb_article_title?: string;
    kb_article?: string;
    prompt_fix?: string;
    summary?: string;
  }>(userMessage);

  return {
    prompt_fix: raw.prompt_fix || pattern.prompt_fix || "Add anti-hallucination instructions.",
    kb_article: raw.kb_article || "",
    kb_article_title: raw.kb_article_title || `${pattern.title} — Correction`,
    summary: raw.summary || "Corrective content to prevent fabrication.",
  };
}

async function generateEscalationFix(
  pattern: FailurePattern,
  samples: ReturnType<typeof fetchAffectedSamples> extends Promise<infer T> ? T : never
): Promise<{ prompt_fix: string; kb_article: string | null; kb_article_title: string | null; summary: string }> {
  const userMessage = `Pattern: ${pattern.title}
Description: ${pattern.description}

Conversation summaries (customers escalated early):
${samples.map((s, i) => `${i + 1}. (Score: ${(s.score * 100).toFixed(0)}%) ${s.summary}`).join("\n")}

Generate a system prompt addition that helps the agent:
1. Build credibility immediately at conversation start
2. Proactively address customer concerns before they request escalation
3. Know when escalation is appropriate vs when to persist

Return JSON:
{
  "prompt_fix": "<exact system prompt text to add, 100-200 words, formatted as clear instructions>",
  "summary": "<one sentence: what behavior change this prompt addition drives>"
}`;

  const raw = await generateJson<{
    prompt_fix?: string;
    summary?: string;
  }>(userMessage);

  return {
    prompt_fix: raw.prompt_fix || pattern.prompt_fix || "Improve opening message.",
    kb_article: null,
    kb_article_title: null,
    summary: raw.summary || "System prompt update to reduce unnecessary escalations.",
  };
}

async function generateToneDriftFix(
  pattern: FailurePattern,
  samples: ReturnType<typeof fetchAffectedSamples> extends Promise<infer T> ? T : never
): Promise<{ prompt_fix: string; kb_article: string | null; kb_article_title: string | null; summary: string }> {
  const userMessage = `Pattern: ${pattern.title}
Description: ${pattern.description}

Conversation summaries (these had poor tone):
${samples.map((s, i) => `${i + 1}. (Score: ${(s.score * 100).toFixed(0)}%) ${s.summary}`).join("\n")}

Generate specific tone guidelines to add to the agent's system prompt.
Focus on practical, observable behaviors (e.g., specific phrases to use/avoid).

Return JSON:
{
  "prompt_fix": "<tone guidelines to add to system prompt, 100-200 words, use concrete examples>",
  "summary": "<one sentence: what tone problem this addresses and the expected improvement>"
}`;

  const raw = await generateJson<{
    prompt_fix?: string;
    summary?: string;
  }>(userMessage);

  return {
    prompt_fix: raw.prompt_fix || pattern.prompt_fix || "Strengthen tone guidelines.",
    kb_article: null,
    kb_article_title: null,
    summary: raw.summary || "Tone adjustment guidelines to reverse degradation.",
  };
}

async function generateResolutionFix(
  pattern: FailurePattern,
  samples: ReturnType<typeof fetchAffectedSamples> extends Promise<infer T> ? T : never
): Promise<{ prompt_fix: string; kb_article: string; kb_article_title: string; summary: string }> {
  const userMessage = `Pattern: ${pattern.title}
Description: ${pattern.description}

Conversation summaries (issues were not resolved):
${samples.map((s, i) => `${i + 1}. (Score: ${(s.score * 100).toFixed(0)}%) ${s.summary}`).join("\n")}

Generate:
1. A resolution playbook KB article with step-by-step procedures for this issue type
2. A system prompt addition that guides the agent through proper resolution

Return JSON:
{
  "kb_article_title": "<playbook title>",
  "kb_article": "<step-by-step resolution guide, 300-500 words, markdown with numbered steps>",
  "prompt_fix": "<system prompt text that instructs the agent to follow the resolution playbook, 50-100 words>",
  "summary": "<one sentence: what issue type this resolves and the key improvement>"
}`;

  const raw = await generateJson<{
    kb_article_title?: string;
    kb_article?: string;
    prompt_fix?: string;
    summary?: string;
  }>(userMessage);

  return {
    prompt_fix: raw.prompt_fix || pattern.prompt_fix || "Follow the resolution playbook.",
    kb_article: raw.kb_article || "",
    kb_article_title: raw.kb_article_title || `${pattern.title} — Resolution Playbook`,
    summary: raw.summary || "Resolution playbook for recurring failure type.",
  };
}

// ─── Main Fix Generator ─────────────────────────────────────────────
/**
 * Generates a specific, model-generated fix for a failure pattern.
 * Fetches pattern details and affected conversation samples from DB,
 * then calls the appropriate specialized generator based on pattern_type.
 *
 * Updates the failure_patterns record with the generated content.
 *
 * @param patternId - The failure_patterns record ID to generate a fix for
 * @returns The generated fix content and updated pattern data
 */
export async function generateFixForPattern(patternId: string): Promise<GeneratedFix> {
  // Fetch the pattern
  const { data: pattern, error } = await supabaseAdmin
    .from("failure_patterns")
    .select("*")
    .eq("id", patternId)
    .single();

  if (error || !pattern) {
    throw new Error(`Pattern ${patternId} not found: ${error?.message}`);
  }

  const p = pattern as FailurePattern;

  // Fetch sample conversations for context
  const samples = await fetchAffectedSamples(p.affected_conversation_ids || []);

  // ── Route to the correct generator ────────────────────────────
  let fixContent: {
    prompt_fix: string | null;
    kb_article: string | null;
    kb_article_title: string | null;
    summary: string;
  };

  try {
    switch (p.pattern_type) {
      case "knowledge_gap":
      case "topic_cluster":
        fixContent = await generateKnowledgeGapFix(p, samples);
        break;

      case "hallucination_cluster":
        fixContent = await generateHallucinationFix(p, samples);
        break;

      case "escalation_trigger":
        fixContent = await generateEscalationFix(p, samples);
        break;

      case "tone_drift":
        fixContent = await generateToneDriftFix(p, samples);
        break;

      case "resolution_failure":
        fixContent = await generateResolutionFix(p, samples);
        break;

      default:
        // For unknown pattern types, generate a generic knowledge gap fix
        fixContent = await generateKnowledgeGapFix(p, samples);
    }
  } catch (e) {
    console.error(`[fix-generator] Model call failed for pattern ${patternId}:`, e);

    // Return a degraded fix using the pre-existing static recommendation
    fixContent = {
      prompt_fix: p.prompt_fix || null,
      kb_article: null,
      kb_article_title: null,
      summary: "Automated fix generation failed — use the recommendation above as a starting point.",
    };
  }

  // ── Persist generated fix back to the pattern record ──────────
  const updateData: Record<string, string | null> = {};
  if (fixContent.prompt_fix) updateData.prompt_fix = fixContent.prompt_fix;
  if (fixContent.kb_article) updateData.knowledge_base_suggestion = fixContent.kb_article;

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("failure_patterns")
      .update(updateData)
      .eq("id", patternId);

    if (updateError) {
      console.error("[fix-generator] Failed to update pattern record:", updateError);
    }
  }

  const result: GeneratedFix = {
    pattern_id: patternId,
    pattern_type: p.pattern_type,
    prompt_fix: fixContent.prompt_fix,
    kb_article: fixContent.kb_article,
    kb_article_title: fixContent.kb_article_title,
    summary: fixContent.summary,
  };

  console.log(
    `[fix-generator] Generated ${p.pattern_type} fix for pattern ${patternId}: ${fixContent.summary}`
  );

  return result;
}

/**
 * Generates fixes for all unresolved patterns in a workspace that
 * don't already have generated content.
 *
 * @param workspaceId - The workspace to process
 * @returns Array of generated fixes
 */
export async function generateFixesForWorkspace(
  workspaceId: string
): Promise<GeneratedFix[]> {
  // Find patterns without generated fix content
  const { data: patterns } = await supabaseAdmin
    .from("failure_patterns")
    .select("id, pattern_type")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", false)
    .is("prompt_fix", null); // Only process patterns without existing fix content

  if (!patterns || patterns.length === 0) return [];

  const fixes: GeneratedFix[] = [];

  // Process sequentially to avoid overwhelming the model API
  for (const pattern of patterns) {
    try {
      const fix = await generateFixForPattern(pattern.id as string);
      fixes.push(fix);
    } catch (e) {
      console.error(`[fix-generator] Failed to generate fix for ${pattern.id}:`, e);
    }
  }

  return fixes;
}
