/**
 * Alert Engine
 *
 * Checks quality scores against workspace-configured thresholds,
 * creates alert records, and optionally sends email notifications via Resend.
 *
 * Alert flow:
 *   scoreConversation() → checkThresholds() → createAlert() → sendAlertEmail()
 *
 * Requires:
 *   RESEND_API_KEY — optional, for email delivery
 *   RESEND_FROM_EMAIL — optional, defaults to 'alerts@agentgrade.io'
 */

import { supabaseAdmin } from "@/lib/supabase";
import type { Alert, AlertConfig, QualityScore } from "@/lib/db/types";
import { isInsightEligibleScore } from "@/lib/scoring/quality-score-status";

const ALERT_DEDUPE_WINDOW_HOURS = 6;

// ─── Dimension → Display Name Map ──────────────────────────────────
const DIMENSION_LABELS: Record<string, string> = {
  overall: "Overall Quality",
  accuracy: "Accuracy",
  hallucination: "Hallucination Prevention",
  resolution: "Resolution Rate",
  tone: "Tone & Professionalism",
  sentiment: "Customer Sentiment",
  edge_case: "Edge Case Handling",
  escalation: "Escalation Handling",
};

// ─── Score Extraction ───────────────────────────────────────────────
/**
 * Extracts all scoreable dimensions from a quality score object.
 * Returns a map of dimension name → score value.
 */
function extractScores(
  qualityScore: Partial<QualityScore>
): Record<string, number | undefined> {
  return {
    overall: qualityScore.overall_score,
    accuracy: qualityScore.accuracy_score,
    hallucination: qualityScore.hallucination_score,
    resolution: qualityScore.resolution_score,
    tone: qualityScore.tone_score,
    sentiment: qualityScore.sentiment_score,
    edge_case: qualityScore.edge_case_score,
    escalation: qualityScore.escalation_score,
  };
}

// ─── Create Alert ───────────────────────────────────────────────────
/**
 * Inserts an alert record into the database.
 * Returns the created alert ID.
 */
export async function createAlert(
  workspaceId: string,
  alertType: string,
  title: string,
  description: string,
  thresholdValue?: number,
  actualValue?: number
): Promise<string | null> {
  const recentCutoff = new Date();
  recentCutoff.setHours(recentCutoff.getHours() - ALERT_DEDUPE_WINDOW_HOURS);

  const { data: existing } = await supabaseAdmin
    .from("alerts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("alert_type", alertType)
    .eq("title", title)
    .gte("triggered_at", recentCutoff.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id as string;
  }

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({
      workspace_id: workspaceId,
      alert_type: alertType,
      title,
      description,
      threshold_value: thresholdValue ?? null,
      actual_value: actualValue ?? null,
      triggered_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[alerts] Failed to create alert:", error);
    return null;
  }

  return data?.id ?? null;
}

// ─── Check Thresholds ───────────────────────────────────────────────
/**
 * Compares a quality score against all enabled alert configs for the workspace.
 * Creates an alert for each dimension that falls below its configured threshold.
 *
 * Also sends email notifications if RESEND_API_KEY is configured.
 */
export async function checkThresholds(
  workspaceId: string,
  qualityScore: Partial<QualityScore>
): Promise<void> {
  if (!isInsightEligibleScore(qualityScore)) {
    return;
  }

  // Fetch all enabled alert configs for this workspace
  const { data: configs, error } = await supabaseAdmin
    .from("alert_configs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  if (error || !configs || configs.length === 0) return;

  const scores = extractScores(qualityScore);

  for (const config of configs as AlertConfig[]) {
    const actual = scores[config.dimension];

    // Skip if score not available or within acceptable range
    if (actual === undefined || actual >= config.threshold) continue;

    const dimensionLabel = DIMENSION_LABELS[config.dimension] || config.dimension;
    const actualPct = (actual * 100).toFixed(0);
    const thresholdPct = (config.threshold * 100).toFixed(0);

    const title = `${dimensionLabel} score below threshold (${actualPct}%)`;
    const description =
      `Conversation scored ${actualPct}% on ${dimensionLabel}, ` +
      `below the configured threshold of ${thresholdPct}%.`;

    const alertId = await createAlert(
      workspaceId,
      "score_below_threshold",
      title,
      description,
      config.threshold,
      actual
    );

    // Send email notification if Resend is configured
    if (alertId && process.env.RESEND_API_KEY) {
      // Fire-and-forget — don't block scoring
      sendAlertEmail(alertId, workspaceId).catch((e) =>
        console.warn("[alerts] Email notification failed:", e)
      );
    }
  }
}

// ─── Send Alert Email ───────────────────────────────────────────────
/**
 * Sends an alert notification email via Resend.
 * Fetches workspace name and owner email from the database.
 *
 * Requires RESEND_API_KEY env var. Does nothing if not set.
 */
export async function sendAlertEmail(
  alertId: string,
  workspaceId: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return; // Email not configured — silently skip

  // Fetch alert details
  const { data: alert, error: alertError } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .eq("id", alertId)
    .single();

  if (alertError || !alert) {
    console.warn("[alerts] Could not fetch alert for email:", alertError);
    return;
  }

  const alertData = alert as Alert;

  // Fetch workspace name and owner email
  const { data: workspaceData } = await supabaseAdmin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();

  const { data: ownerData } = await supabaseAdmin
    .from("workspace_members")
    .select("clerk_user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .single();

  const workspaceName = (workspaceData as { name?: string })?.name || "Your Workspace";
  const ownerId = (ownerData as { clerk_user_id?: string })?.clerk_user_id;

  if (!ownerId) {
    console.warn("[alerts] No owner found for workspace:", workspaceId);
    return;
  }

  // Use RESEND_ALERT_TO if set, otherwise we'd need to fetch the email from Clerk
  // For now, use the configured recipient
  const toEmail = process.env.RESEND_ALERT_TO;
  if (!toEmail) {
    console.warn("[alerts] RESEND_ALERT_TO not set — cannot send alert email");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@agentgrade.io";
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.agentgrade.io";

  const html = buildAlertEmailHtml(alertData, workspaceName, dashboardUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `AgentGrade Alerts <${fromEmail}>`,
      to: [toEmail],
      subject: `[AgentGrade Alert] ${alertData.title} — ${workspaceName}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[alerts] Resend API error:", response.status, errorText);
  } else {
    console.log(`[alerts] Alert email sent for alert ${alertId}`);
  }
}

// ─── Email HTML Template ────────────────────────────────────────────
function buildAlertEmailHtml(
  alert: Alert,
  workspaceName: string,
  dashboardUrl: string
): string {
  const triggeredAt = new Date(alert.triggered_at).toLocaleString();
  const actualPct = alert.actual_value !== undefined
    ? `${(alert.actual_value * 100).toFixed(0)}%`
    : "N/A";
  const thresholdPct = alert.threshold_value !== undefined
    ? `${(alert.threshold_value * 100).toFixed(0)}%`
    : "N/A";

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #dc2626; color: white; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 4px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 24px; }
    .metric { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .metric .actual { font-size: 32px; font-weight: 700; color: #dc2626; }
    .metric .threshold { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quality Alert</h1>
      <p>${workspaceName} · ${triggeredAt}</p>
    </div>
    <div class="body">
      <h2 style="margin-top:0">${alert.title}</h2>
      <p style="color:#6b7280">${alert.description || ""}</p>
      <div class="metric">
        <div class="actual">${actualPct}</div>
        <div class="threshold">Threshold: ${thresholdPct}</div>
      </div>
      <p>A conversation scored below your configured threshold. Review it in your dashboard to understand the issue and take action.</p>
      <a class="btn" href="${dashboardUrl}/dashboard/conversations">View Conversations →</a>
    </div>
    <div class="footer">
      You're receiving this because you have alerts enabled in AgentGrade.
      <a href="${dashboardUrl}/dashboard/settings">Manage alerts</a>
    </div>
  </div>
</body>
</html>`.trim();
}
