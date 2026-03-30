export type ReviewDisposition =
  | "safe"
  | "watch"
  | "action_needed"
  | "escalate_issue"
  | "ignore";

export type QueueWorkflowState =
  | "new"
  | "needs_review"
  | "reviewed"
  | "escalated"
  | "safe"
  | "snoozed";

export type IssueWorkflowState =
  | "new"
  | "monitoring"
  | "actioning"
  | "quieted"
  | "resolved";

export interface ConversationWorkflowRecord {
  disposition?: ReviewDisposition;
  queue_state?: QueueWorkflowState;
  updated_at?: string;
}

export const REVIEW_DISPOSITIONS = [
  "safe",
  "watch",
  "action_needed",
  "escalate_issue",
  "ignore",
] as const satisfies readonly ReviewDisposition[];

export const QUEUE_WORKFLOW_STATES = [
  "new",
  "needs_review",
  "reviewed",
  "escalated",
  "safe",
  "snoozed",
] as const satisfies readonly QueueWorkflowState[];

export const ISSUE_WORKFLOW_STATES = [
  "new",
  "monitoring",
  "actioning",
  "quieted",
  "resolved",
] as const satisfies readonly IssueWorkflowState[];

export function isReviewDisposition(value: unknown): value is ReviewDisposition {
  return typeof value === "string" && REVIEW_DISPOSITIONS.includes(value as ReviewDisposition);
}

export function isQueueWorkflowState(value: unknown): value is QueueWorkflowState {
  return typeof value === "string" && QUEUE_WORKFLOW_STATES.includes(value as QueueWorkflowState);
}

export function isIssueWorkflowState(value: unknown): value is IssueWorkflowState {
  return typeof value === "string" && ISSUE_WORKFLOW_STATES.includes(value as IssueWorkflowState);
}

export function getConversationWorkflow(metadata?: Record<string, unknown> | null): ConversationWorkflowRecord | null {
  const workflow = metadata?.review_workflow;
  if (!workflow || typeof workflow !== "object") {
    return null;
  }

  const record = workflow as Record<string, unknown>;
  return {
    disposition: isReviewDisposition(record.disposition) ? record.disposition : undefined,
    queue_state: isQueueWorkflowState(record.queue_state) ? record.queue_state : undefined,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
  };
}
