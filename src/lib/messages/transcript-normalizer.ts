import type { Message } from "@/lib/db/types";

type ComparableMessage = Pick<Message, "role" | "content" | "timestamp">;

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().toLowerCase();
}

export function getMessageFingerprint(message: Pick<ComparableMessage, "role" | "content">): string {
  return `${message.role}::${normalizeContent(message.content)}`;
}

function hasProvidedTimestamp(timestamp?: string): boolean {
  if (!timestamp) return false;
  const parsed = new Date(timestamp);
  return !Number.isNaN(parsed.getTime());
}

function toIsoTimestamp(timestamp?: string, fallback = Date.now()): string {
  if (hasProvidedTimestamp(timestamp)) {
    return new Date(timestamp as string).toISOString();
  }

  return new Date(fallback).toISOString();
}

function findPrefixMatchLength(existing: string[], incoming: string[]): number {
  const limit = Math.min(existing.length, incoming.length);
  let matched = 0;

  while (matched < limit && existing[matched] === incoming[matched]) {
    matched += 1;
  }

  return matched;
}

function findOverlapLength(existing: string[], incoming: string[]): number {
  const limit = Math.min(existing.length, incoming.length);

  for (let overlap = limit; overlap >= 1; overlap -= 1) {
    const existingSlice = existing.slice(existing.length - overlap);
    const incomingSlice = incoming.slice(0, overlap);
    if (existingSlice.every((fingerprint, index) => fingerprint === incomingSlice[index])) {
      return overlap;
    }
  }

  return 0;
}

function diffByOccurrence(
  existingFingerprints: string[],
  incoming: Array<Pick<ComparableMessage, "role" | "content">>
): number[] {
  const existingCounts = new Map<string, number>();
  for (const fingerprint of existingFingerprints) {
    existingCounts.set(fingerprint, (existingCounts.get(fingerprint) || 0) + 1);
  }

  const incomingSeen = new Map<string, number>();
  const indicesToInsert: number[] = [];

  incoming.forEach((message, index) => {
    const fingerprint = getMessageFingerprint(message);
    const seen = (incomingSeen.get(fingerprint) || 0) + 1;
    incomingSeen.set(fingerprint, seen);

    if (seen > (existingCounts.get(fingerprint) || 0)) {
      indicesToInsert.push(index);
    }
  });

  return indicesToInsert;
}

export function prepareMessagesForInsert(
  existingMessages: ComparableMessage[],
  incomingMessages: Array<{
    role: Message["role"];
    content: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>
): Array<{
  role: Message["role"];
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}> {
  const existingFingerprints = existingMessages.map(getMessageFingerprint);
  const incomingFingerprints = incomingMessages.map(getMessageFingerprint);

  const prefixMatchLength = findPrefixMatchLength(existingFingerprints, incomingFingerprints);
  let indicesToInsert: number[] = [];

  if (prefixMatchLength === existingMessages.length && incomingMessages.length >= existingMessages.length) {
    indicesToInsert = incomingMessages.map((_, index) => index).slice(existingMessages.length);
  } else {
    const overlapLength = findOverlapLength(existingFingerprints, incomingFingerprints);
    if (overlapLength > 0) {
      indicesToInsert = incomingMessages.map((_, index) => index).slice(overlapLength);
    } else {
      indicesToInsert = diffByOccurrence(existingFingerprints, incomingMessages);
    }
  }

  const lastExistingTimestamp = existingMessages.length
    ? new Date(existingMessages[existingMessages.length - 1].timestamp).getTime()
    : Date.now();

  let syntheticCursor = Number.isNaN(lastExistingTimestamp) ? Date.now() : lastExistingTimestamp + 1000;

  return indicesToInsert.map((index) => {
    const message = incomingMessages[index];
    const fallbackTimestamp = syntheticCursor;
    syntheticCursor += 1000;
    const timestamp = hasProvidedTimestamp(message.timestamp)
      ? toIsoTimestamp(message.timestamp)
      : toIsoTimestamp(undefined, fallbackTimestamp);

    return {
      role: message.role,
      content: message.content.trim(),
      timestamp,
      metadata: message.metadata || {},
    };
  });
}

export function compactReplayArtifacts<T extends ComparableMessage>(messages: T[]): T[] {
  const compacted: T[] = [];
  let index = 0;

  while (index < messages.length) {
    const currentFingerprint = getMessageFingerprint(messages[index]);
    let bestMatchLength = 0;

    for (let start = 0; start < compacted.length; start += 1) {
      if (getMessageFingerprint(compacted[start]) !== currentFingerprint) continue;

      let matched = 0;
      while (
        index + matched < messages.length &&
        start + matched < compacted.length &&
        getMessageFingerprint(messages[index + matched]) ===
          getMessageFingerprint(compacted[start + matched])
      ) {
        matched += 1;
      }

      if (matched > bestMatchLength) {
        bestMatchLength = matched;
      }
    }

    // Only collapse when we have a meaningful repeated block,
    // which avoids hiding legitimate repeated single-turn messages.
    if (bestMatchLength >= 2) {
      index += bestMatchLength;
      continue;
    }

    compacted.push(messages[index]);
    index += 1;
  }

  return compacted;
}
