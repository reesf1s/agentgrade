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

type WorkflowStore = {
  conversationDisposition?: Record<string, ReviewDisposition>;
  queueState?: Record<string, QueueWorkflowState>;
  issueState?: Record<string, IssueWorkflowState>;
};

export interface ConversationWorkflowRecord {
  disposition?: ReviewDisposition;
  queue_state?: QueueWorkflowState;
  updated_at?: string;
}

const STORAGE_KEY = "agentgrade-review-workflow";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): WorkflowStore {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WorkflowStore;
  } catch {
    return {};
  }
}

function writeStore(next: WorkflowStore) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getConversationDispositionMap() {
  return readStore().conversationDisposition || {};
}

export function setConversationDisposition(conversationId: string, disposition: ReviewDisposition) {
  const store = readStore();
  writeStore({
    ...store,
    conversationDisposition: {
      ...(store.conversationDisposition || {}),
      [conversationId]: disposition,
    },
  });
}

export function getQueueStateMap() {
  return readStore().queueState || {};
}

export function setQueueState(conversationId: string, state: QueueWorkflowState) {
  const store = readStore();
  writeStore({
    ...store,
    queueState: {
      ...(store.queueState || {}),
      [conversationId]: state,
    },
  });
}

export function getIssueStateMap() {
  return readStore().issueState || {};
}

export function setIssueState(issueId: string, state: IssueWorkflowState) {
  const store = readStore();
  writeStore({
    ...store,
    issueState: {
      ...(store.issueState || {}),
      [issueId]: state,
    },
  });
}

export function getConversationWorkflow(metadata?: Record<string, unknown> | null): ConversationWorkflowRecord | null {
  const workflow = metadata?.review_workflow;
  if (!workflow || typeof workflow !== "object") {
    return null;
  }

  const record = workflow as Record<string, unknown>;
  return {
    disposition:
      typeof record.disposition === "string" ? (record.disposition as ReviewDisposition) : undefined,
    queue_state:
      typeof record.queue_state === "string" ? (record.queue_state as QueueWorkflowState) : undefined,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
  };
}
