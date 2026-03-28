# AgentGrade Pre-Launch Engineering Alignment

## Purpose

This document does not redefine the MVP. It clarifies how the existing product should behave under real-world launch conditions so engineering, product, and support can ship it safely.

It covers:
- system state transitions
- canonical data contracts
- background job and retry expectations
- scoring trust and confidence rules
- manual fallback paths
- observability requirements
- launch acceptance criteria

## What Stays the Same

These areas are intentionally preserved unless they are actually broken:
- current integration paths
- current scoring dimensions
- current database structure, with additive clarifications only
- current onboarding breadth
- current product positioning

The goal is launch safety and trust, not scope churn.

## 1. System Lifecycle and State Transitions

### 1.1 Agent Connections

Object: `agent_connections`

Allowed states:
- `pending`
- `active`
- `syncing`
- `degraded`
- `disconnected`
- `error`

Expected transitions:
- `pending -> active` after validation succeeds
- `active -> syncing` when an import or manual sync starts
- `syncing -> active` when sync completes cleanly
- `syncing -> degraded` on partial sync failure
- `active -> degraded` on auth expiry, webhook failure, or upstream API issues
- `degraded -> active` when retries succeed
- `any -> disconnected` when a user disconnects the integration
- `any -> error` when repeated failures exceed retry policy

UI expectations:
- always show current state
- always show last successful sync
- always show last failed sync when relevant
- always show the next recommended action

No integration should fail silently.

### 1.2 Conversation Processing

Object: `conversations`

Allowed states:
- `ingested`
- `queued_for_scoring`
- `scoring`
- `scored`
- `scoring_failed`
- `archived`

Expected transitions:
- new conversation becomes `ingested`
- after persistence it becomes `queued_for_scoring`
- scorer worker moves it to `scoring`
- persisted score moves it to `scored`
- repeated scorer failure moves it to `scoring_failed`

Rules:
- `scoring_failed` conversations stay visible for replay and debugging
- the UI should show `Scoring pending` or `Scoring failed`, never a silent missing-score state
- open conversations should show `Waiting for completion`, not pretend they were fully evaluated

### 1.3 Suggested Fixes

Object: `suggested_fixes`

Allowed states:
- `draft`
- `approved`
- `pushing`
- `pushed`
- `push_failed`
- `verified`
- `dismissed`

Expected transitions:
- generated fixes start as `draft`
- user review moves them to `approved`
- outbound push moves them to `pushing`
- successful write-back moves them to `pushed`
- failed write-back moves them to `push_failed`
- later measured improvement moves them to `verified`
- user rejection moves them to `dismissed`

Rules:
- no fix should disappear because a push failed
- approval, push, and verification must remain auditable

## 2. Canonical Internal Data Contracts

All integrations normalize into a shared internal conversation contract before scoring, patterning, or rendering.

### 2.1 Canonical Conversation Shape

```json
{
  "conversation_id": "uuid",
  "workspace_id": "uuid",
  "agent_connection_id": "uuid",
  "source_platform": "intercom|zendesk|custom|webhook|csv|voice|slack|teams",
  "external_id": "string",
  "started_at": "ISO8601",
  "ended_at": "ISO8601|null",
  "status": "open|closed|unknown",
  "was_escalated": true,
  "metadata": {
    "customer_id": "string|null",
    "customer_email": "string|null",
    "channel": "chat|email|voice|internal|unknown",
    "tags": []
  },
  "messages": [
    {
      "message_id": "uuid",
      "role": "customer|agent|human_agent|system|tool",
      "content": "string",
      "timestamp": "ISO8601",
      "metadata": {}
    }
  ]
}
```

Requirements:
- messages must be stored chronologically
- empty messages must be dropped
- hidden internal messages should not surface in customer-facing UI unless useful
- conversations must be idempotent on `(workspace_id, source_platform, external_id)`

### 2.2 Canonical Scoring Output Shape

```json
{
  "overall_score": 0.0,
  "dimension_scores": {
    "accuracy": 0.0,
    "hallucination": 0.0,
    "resolution": 0.0,
    "tone": 0.0,
    "brand_alignment": 0.0,
    "escalation_handling": 0.0,
    "edge_case_handling": 0.0,
    "sentiment_outcome": 0.0
  },
  "summary": "string",
  "confidence": 0.0,
  "flags": [
    {
      "type": "hallucination|incorrect_info|poor_resolution|tone_issue|escalation_failure|other",
      "severity": "low|medium|high|critical",
      "message_index": 0,
      "reason": "string"
    }
  ],
  "suggested_actions": [
    {
      "type": "kb_update|new_article|prompt_update|handoff_rule|workflow_change",
      "title": "string",
      "description": "string"
    }
  ]
}
```

Requirements:
- all scores normalized to `0.0-1.0`
- unsupported dimensions may be `null` internally but the UI must degrade gracefully
- model output must be schema-validated before persistence
- raw model output should be retained only for internal debugging

## 3. Background Jobs and Retry Behavior

All expensive or failure-prone work should be asynchronous.

Required job types:
- `sync_conversations`
- `sync_knowledge_base`
- `score_conversation`
- `detect_failure_patterns`
- `generate_suggested_fix`
- `push_fix`
- `generate_weekly_report`

Default retry policy:
- first retry after 1 minute
- second retry after 5 minutes
- third retry after 30 minutes
- then mark failed and surface internally

Retries should apply to:
- LLM timeouts
- provider failures
- webhook processing failures
- sync failures
- fix push failures

Retries must not loop forever.

Any repeated failure must:
- remain inspectable
- include replay context
- avoid duplicate downstream actions

## 4. Idempotency Requirements

All mutating jobs must be idempotent.

Required protections:
- duplicate conversation deliveries must not create duplicate conversations
- repeated scoring should overwrite by version, not create confusing duplicates
- repeat push attempts must not blindly overwrite approved content without audit
- repeat weekly report generation should update or version clearly

## 5. Scoring Trust and Confidence Rules

### 5.1 Confidence Thresholds

Suggested interpretation:
- `0.85-1.0` high confidence
- `0.65-0.84` medium confidence
- `< 0.65` low confidence

Low confidence results may still be shown, but should:
- be deprioritized in pattern generation
- avoid aggressive automated fix suggestions
- be easier to override and review

### 5.2 Human Overrides

Overrides are first-class data.

Requirements:
- allow dimension-level overrides
- preserve original scores
- encourage but do not require a reason
- surface overrides in internal analysis
- feed overrides into calibration workflows later

Overrides must never silently replace originals without auditability.

### 5.3 False Positive Protection

The most damaging launch failure is flagging clearly good conversations as broken.

Scoring should be conservative when:
- KB grounding is absent
- the customer simply stopped replying
- context is incomplete
- tone issues are not obvious

When ambiguous, prefer:
- lower severity
- lower confidence
- review-oriented framing

## 6. Manual Fallback Paths

### 6.1 If Sync Fails

Support must be able to:
- rerun sync manually
- inspect the latest error
- confirm last successful import

### 6.2 If Scoring Fails

Support must be able to:
- replay scoring for a single conversation
- replay scoring for a batch
- inspect raw error output

### 6.3 If Pattern Detection Is Weak

Internal teams must be able to:
- suppress a pattern
- merge duplicates
- regenerate patterns later

### 6.4 If Fix Push Fails

Users must still be able to:
- copy suggested content manually
- retry push
- keep the fix in an approved state

### 6.5 If Weekly Reports Fail

Internal teams must be able to:
- regenerate for a workspace or date range
- preview before sending when necessary

## 7. Observability and Internal Admin Needs

Internal tooling must make it easy to answer:
- did this workspace sync
- did this conversation score
- why did the job fail
- was the fix actually pushed
- when was this customer last updated

Minimum internal admin view:
- workspace name
- plan
- connected integrations
- integration state
- last successful sync
- last failed sync
- conversations ingested count
- conversations scored count
- failed jobs count
- latest weekly report status
- latest fix push status

This can be ugly at launch. It just needs to exist.

## 8. Launch Acceptance Criteria

### 8.1 Ingestion

- new conversations ingest without duplication
- historical sync succeeds for supported integrations
- failed syncs are retriable
- integration health is visible

### 8.2 Scoring

- new conversations are queued automatically
- scores persist cleanly
- invalid model output does not break the pipeline
- failed scoring can be retried
- conversation detail explains poor scores clearly

### 8.3 Patterns and Fixes

- low-quality conversations cluster into understandable patterns
- each pattern has a readable root-cause summary
- fixes are reviewable before approval
- supported write-backs can be retried
- failed pushes do not dead-end

### 8.4 Reporting

- weekly reports generate for active workspaces
- reports include trend, patterns, and actions
- reports can be regenerated
- alerts fire only when thresholds are truly met

### 8.5 Launch Safety

- no silent failure in critical workflows
- all critical jobs have retry behavior
- empty and error states exist in core UI
- workspace isolation holds
- secrets are encrypted and not logged
- support can debug a broken workspace without code changes

## 9. Recommended Pre-Launch Priorities

### P0

- ingestion reliability
- scoring reliability
- score explanation trust
- directionally useful patterns
- fix approval flow
- retryability
- admin visibility
- launch-safe error handling

### P1

- better clustering quality
- better push verification
- richer report exports
- benchmark-readiness plumbing
- more polished analytics

### P2

- deeper automation
- richer permissions
- aesthetic polish beyond core product surfaces
- more advanced explainability layers
- edge-case workflow optimization

## 10. Product Truth for the Current Scoring Stack

AgentGrade should describe its evaluation stack honestly:
- the base judge is an API-hosted LLM evaluator
- deterministic guardrails adjust obviously incorrect outcomes
- human labels create a learned calibration layer
- workspace-private labels stay within the org
- globally shared training uses anonymized score features and labels, not raw transcripts

This keeps the product trustworthy while still allowing the scoring system to become meaningfully learned over time.
