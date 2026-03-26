/**
 * Pass 1: Structural Analysis — Zero API calls
 *
 * Extracts metrics, detects patterns, and classifies conversations
 * entirely locally. This is defensible IP — the heuristics improve
 * with every conversation analyzed.
 */

import type { Message, StructuralMetrics } from "@/lib/db/types";

// ─── Sentiment Lexicon ─────────────────────────────────────────────
// Curated lexicon for customer support contexts. Weighted by intensity.
const POSITIVE_WORDS: Record<string, number> = {
  thank: 1.5, thanks: 1.5, "thank you": 2, great: 1.2, perfect: 1.5,
  excellent: 1.5, awesome: 1.3, wonderful: 1.3, helpful: 1.4, solved: 1.5,
  resolved: 1.5, fixed: 1.3, appreciate: 1.4, love: 1.2, amazing: 1.3,
  fantastic: 1.3, brilliant: 1.3, good: 0.8, nice: 0.7, happy: 1.0,
  pleased: 1.0, satisfied: 1.1, works: 1.0, working: 1.0, clear: 0.9,
  understand: 0.8, easy: 0.9, quick: 0.8, fast: 0.8, "well done": 1.5,
};

const NEGATIVE_WORDS: Record<string, number> = {
  frustrated: -1.5, angry: -1.8, terrible: -2.0, horrible: -2.0,
  awful: -1.8, worst: -2.0, useless: -1.8, broken: -1.5, wrong: -1.3,
  incorrect: -1.3, false: -1.2, lie: -1.5, lied: -1.8, misleading: -1.5,
  confusing: -1.2, confused: -1.1, annoying: -1.3, annoyed: -1.4,
  disappointed: -1.5, unacceptable: -1.8, ridiculous: -1.5, stupid: -1.8,
  hate: -1.8, waste: -1.3, never: -0.8, "doesn't work": -1.5,
  "not working": -1.5, "still broken": -1.8, "no help": -1.5,
  "give up": -1.5, "cancel": -1.2, "refund": -0.8, problem: -0.8,
  issue: -0.6, bug: -0.8, error: -0.7, fail: -1.2, failed: -1.3,
};

// ─── Escalation Signals ────────────────────────────────────────────
const ESCALATION_PATTERNS = [
  /speak\s+(to|with)\s+(a\s+)?(human|person|agent|manager|supervisor|someone)/i,
  /talk\s+(to|with)\s+(a\s+)?(human|person|real|agent|manager)/i,
  /transfer\s+(me|to)/i,
  /real\s+(person|human|agent)/i,
  /human\s+(agent|support|help)/i,
  /escalat/i,
  /supervisor/i,
  /manager/i,
  /this\s+is\s+(not|isn't)\s+help/i,
  /can't\s+help\s+me/i,
  /useless\s+(bot|ai|chatbot)/i,
];

// ─── Conversation Type Classification ──────────────────────────────
const TYPE_KEYWORDS: Record<string, string[]> = {
  billing: ["invoice", "charge", "payment", "billing", "subscription", "plan", "price", "cost", "refund", "credit"],
  technical: ["error", "bug", "crash", "not working", "broken", "fix", "update", "install", "configure", "api"],
  account: ["password", "login", "account", "email", "profile", "settings", "access", "locked", "reset"],
  onboarding: ["get started", "how to", "setup", "tutorial", "new to", "first time", "begin", "start using"],
  sales: ["pricing", "demo", "trial", "enterprise", "features", "compare", "upgrade", "custom plan"],
  returns: ["return", "refund", "exchange", "cancel", "shipping", "delivery", "order", "tracking"],
};

// ─── Claim Extraction ──────────────────────────────────────────────
// Identifies factual assertions agents make that can be verified against KB
const CLAIM_PATTERNS = [
  // Policy statements
  /(?:our|the|your)\s+(?:policy|terms|agreement)\s+(?:is|are|states?|requires?|allows?)\s+(.+?)(?:\.|$)/gi,
  // Timeframe claims
  /(?:within|in|takes?|up to|approximately|about)\s+(\d+\s+(?:minutes?|hours?|days?|weeks?|business\s+days?))/gi,
  // Feature/capability claims
  /(?:you can|you're able to|it's possible to|we offer|we provide|we support)\s+(.+?)(?:\.|$)/gi,
  // Pricing/cost claims
  /(?:costs?|priced?\s+at|fee\s+(?:is|of)|charges?)\s+[\$£€]?\d+/gi,
  // URL/link claims
  /(?:visit|go to|check out|see|find\s+(?:it|this)\s+at)\s+(https?:\/\/\S+|[\w.-]+\.(?:com|org|io|co)\S*)/gi,
  // Availability claims
  /(?:available|unavailable|supported|not supported)\s+(?:in|on|for|until)\s+(.+?)(?:\.|$)/gi,
  // Definitive statements
  /(?:the answer is|this is because|the reason is|you need to|you must|you should)\s+(.+?)(?:\.|$)/gi,
];

// ─── Repetition Detection ──────────────────────────────────────────
function detectRepetitions(messages: Message[]): number {
  const agentMessages = messages
    .filter((m) => m.role === "agent")
    .map((m) => m.content.toLowerCase().trim());

  let repetitions = 0;
  for (let i = 1; i < agentMessages.length; i++) {
    const similarity = jaroWinklerSimilarity(agentMessages[i], agentMessages[i - 1]);
    if (similarity > 0.85) repetitions++;
  }
  return repetitions;
}

// Simple Jaro-Winkler for repetition detection (no external deps)
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;

  const window = Math.floor(maxLen / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ─── Sentiment Scoring ─────────────────────────────────────────────
function scoreSentiment(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  let wordCount = 0;

  // Check multi-word phrases first
  for (const [phrase, weight] of Object.entries(POSITIVE_WORDS)) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      score += weight;
      wordCount++;
    }
  }
  for (const [phrase, weight] of Object.entries(NEGATIVE_WORDS)) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      score += weight;
      wordCount++;
    }
  }

  // Single words
  const words = lower.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-z']/g, "");
    if (POSITIVE_WORDS[clean]) {
      score += POSITIVE_WORDS[clean];
      wordCount++;
    }
    if (NEGATIVE_WORDS[clean]) {
      score += NEGATIVE_WORDS[clean];
      wordCount++;
    }
  }

  // Normalize to -1 to 1 range
  if (wordCount === 0) return 0;
  return Math.max(-1, Math.min(1, score / (wordCount * 1.5)));
}

// ─── Claim Extraction ──────────────────────────────────────────────
function extractClaims(messages: Message[]): string[] {
  const claims: string[] = [];

  for (const msg of messages) {
    if (msg.role !== "agent") continue;

    for (const pattern of CLAIM_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(msg.content)) !== null) {
        const claim = match[0].trim();
        if (claim.length > 10 && claim.length < 300) {
          claims.push(claim);
        }
      }
    }
  }

  return [...new Set(claims)]; // Deduplicate
}

// ─── Conversation Type Classification ──────────────────────────────
function classifyConversation(messages: Message[]): string {
  const allText = messages.map((m) => m.content.toLowerCase()).join(" ");
  const scores: Record<string, number> = {};

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    scores[type] = keywords.reduce((count, kw) => {
      const regex = new RegExp(kw, "gi");
      const matches = allText.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  const topType = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return topType && topType[1] > 0 ? topType[0] : "general";
}

// ─── Escalation Detection ──────────────────────────────────────────
function detectEscalation(messages: Message[]): { escalated: boolean; turn?: number } {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "customer") continue;
    for (const pattern of ESCALATION_PATTERNS) {
      if (pattern.test(messages[i].content)) {
        return { escalated: true, turn: i };
      }
    }
  }
  return { escalated: false };
}

// ─── Main Analyzer ─────────────────────────────────────────────────
export function analyzeStructure(messages: Message[]): StructuralMetrics {
  const agentMessages = messages.filter((m) => m.role === "agent");
  const customerMessages = messages.filter((m) => m.role === "customer");

  const avgAgentLen =
    agentMessages.length > 0
      ? agentMessages.reduce((s, m) => s + m.content.length, 0) / agentMessages.length
      : 0;

  const avgCustomerLen =
    customerMessages.length > 0
      ? customerMessages.reduce((s, m) => s + m.content.length, 0) / customerMessages.length
      : 0;

  // Duration
  let durationSeconds: number | undefined;
  if (messages.length >= 2) {
    const first = new Date(messages[0].timestamp).getTime();
    const last = new Date(messages[messages.length - 1].timestamp).getTime();
    if (!isNaN(first) && !isNaN(last)) {
      durationSeconds = Math.round((last - first) / 1000);
    }
  }

  const escalation = detectEscalation(messages);
  const claims = extractClaims(messages);
  const repetitions = detectRepetitions(messages);
  const conversationType = classifyConversation(messages);

  // Per-turn sentiment
  const sentimentPerTurn = messages.map((m, i) => ({
    turn: i,
    role: m.role,
    sentiment: scoreSentiment(m.content),
  }));

  return {
    turn_count: messages.length,
    agent_turns: agentMessages.length,
    customer_turns: customerMessages.length,
    avg_agent_response_length: Math.round(avgAgentLen),
    avg_customer_message_length: Math.round(avgCustomerLen),
    conversation_duration_seconds: durationSeconds,
    escalation_turn: escalation.turn,
    repetition_count: repetitions,
    conversation_type: conversationType,
    extracted_claims: claims,
    sentiment_per_turn: sentimentPerTurn,
  };
}

// ─── Exports for testing ───────────────────────────────────────────
export {
  scoreSentiment,
  extractClaims,
  classifyConversation,
  detectEscalation,
  detectRepetitions,
};
