export const DEFAULT_SCORING_MODEL = process.env.SCORING_MODEL || "gpt-5.4-mini";
export const DEFAULT_SCORING_PROVIDER = process.env.SCORING_PROVIDER || "openai";

export function getScoringProvider() {
  return DEFAULT_SCORING_PROVIDER;
}

export function getScoringModel() {
  return DEFAULT_SCORING_MODEL;
}
