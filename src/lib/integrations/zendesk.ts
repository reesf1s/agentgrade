import { uploadAndProcess } from "@/lib/knowledge-base";
import { scoreConversation } from "@/lib/scoring";
import { upsertConversationWithMessages } from "@/lib/ingest/upsert-conversation";

export interface ZendeskConfig {
  subdomain?: string;
  email?: string;
}

interface ZendeskTicket {
  id: number;
  subject?: string;
  description?: string;
  requester_id?: number;
  assignee_id?: number | null;
  status?: string;
  priority?: string | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  via?: unknown;
}

interface ZendeskComment {
  id: number;
  author_id?: number;
  body?: string;
  plain_body?: string;
  html_body?: string;
  public?: boolean;
  created_at?: string;
  via?: unknown;
  metadata?: unknown;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function stringValuesFromUnknown(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringValuesFromUnknown(item));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      stringValuesFromUnknown(item)
    );
  }
  return [];
}

function normalizeZendeskMessageRole(
  comment: ZendeskComment,
  requesterId?: number
): "customer" | "agent" | "human_agent" | "system" {
  if (requesterId && comment.author_id === requesterId) {
    return "customer";
  }

  if (comment.public === false) {
    return "system";
  }

  const signalText = stringValuesFromUnknown({
    via: comment.via,
    metadata: comment.metadata,
  })
    .join(" ")
    .toLowerCase();

  if (/(bot|assistant|answer bot|ai|automation|flow builder)/.test(signalText)) {
    return "agent";
  }

  return "human_agent";
}

function normalizeZendeskCommentContent(comment: ZendeskComment): string {
  return (
    comment.plain_body ||
    comment.body ||
    stripHtml(comment.html_body || "")
  ).trim();
}

async function zendeskFetch<T>(
  subdomain: string,
  email: string,
  apiToken: string,
  pathOrUrl: string
): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://${subdomain}.zendesk.com${pathOrUrl}`;

  const response = await fetch(url, {
    headers: {
      Authorization: buildZendeskAuthHeader(email, apiToken),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zendesk API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export function buildZendeskAuthHeader(email: string, apiToken: string) {
  const credentials = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  return `Basic ${credentials}`;
}

export async function syncZendeskConversations(input: {
  connectionId: string;
  workspaceId: string;
  apiKey: string | null;
  config: ZendeskConfig;
  lastSyncAt?: string | null;
}): Promise<{ conversations_synced: number; tickets_scanned: number; message: string }> {
  const { connectionId, workspaceId, apiKey, config, lastSyncAt } = input;

  if (!config.subdomain || !config.email || !apiKey) {
    return {
      conversations_synced: 0,
      tickets_scanned: 0,
      message: "Zendesk sync requires subdomain, support email, and API token.",
    };
  }

  const startTime = lastSyncAt
    ? Math.floor(new Date(lastSyncAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  let nextUrl = `https://${config.subdomain}.zendesk.com/api/v2/incremental/tickets/cursor.json?start_time=${startTime}`;
  let pageCount = 0;
  let ticketsScanned = 0;
  let conversationsSynced = 0;

  while (nextUrl && pageCount < 5) {
    const payload = await zendeskFetch<{
      tickets?: ZendeskTicket[];
      after_url?: string | null;
      end_of_stream?: boolean;
    }>(config.subdomain, config.email, apiKey, nextUrl);

    for (const ticket of payload.tickets || []) {
      ticketsScanned++;

      const commentsPayload = await zendeskFetch<{ comments?: ZendeskComment[] }>(
        config.subdomain,
        config.email,
        apiKey,
        `/api/v2/tickets/${ticket.id}/comments.json`
      );

      const messages: Array<{
        role: "customer" | "agent" | "human_agent" | "system";
        content: string;
        timestamp?: string;
      }> = (commentsPayload.comments || [])
        .map((comment) => {
          const content = normalizeZendeskCommentContent(comment);
          if (!content) return null;

          return {
            role: normalizeZendeskMessageRole(comment, ticket.requester_id),
            content,
            timestamp: comment.created_at,
          };
        })
        .filter((message): message is NonNullable<typeof message> => message !== null);

      if (messages.length === 0 && ticket.description) {
        messages.push({
          role: "customer",
          content: ticket.description,
          timestamp: ticket.created_at,
        });
      }

      if (messages.length === 0) {
        continue;
      }

      const result = await upsertConversationWithMessages(
        { id: connectionId, workspace_id: workspaceId },
        {
          externalId: `zendesk-${ticket.id}`,
          platform: "zendesk",
          customerIdentifier: ticket.requester_id ? String(ticket.requester_id) : null,
          metadata: {
            zendesk_ticket_id: ticket.id,
            subject: ticket.subject || null,
            status: ticket.status || null,
            priority: ticket.priority || null,
            tags: ticket.tags || [],
            assignee_id: ticket.assignee_id || null,
          },
          messages,
        }
      );

      if (result.created || result.insertedMessages > 0) {
        await scoreConversation(result.conversationId);
        conversationsSynced++;
      }
    }

    nextUrl = payload.end_of_stream ? "" : payload.after_url || "";
    pageCount++;
  }

  return {
    conversations_synced: conversationsSynced,
    tickets_scanned: ticketsScanned,
    message: `Synced ${conversationsSynced} Zendesk conversations from ${ticketsScanned} updated tickets.`,
  };
}

export async function syncZendeskHelpCenter(input: {
  workspaceId: string;
  apiKey: string | null;
  config: ZendeskConfig;
}): Promise<{ articles_synced: number; articles_skipped: number; total_articles: number; message: string }> {
  const { workspaceId, apiKey, config } = input;

  if (!config.subdomain || !config.email || !apiKey) {
    throw new Error("Zendesk Help Center sync requires subdomain, support email, and API token.");
  }

  const articles: Array<{ id: number; title: string; body?: string; draft?: boolean }> = [];
  let nextUrl = `https://${config.subdomain}.zendesk.com/api/v2/help_center/articles.json?per_page=100`;

  while (nextUrl) {
    const payload = await zendeskFetch<{
      articles?: Array<{ id: number; title: string; body?: string; draft?: boolean }>;
      next_page?: string | null;
    }>(config.subdomain, config.email, apiKey, nextUrl);

    articles.push(...(payload.articles || []).filter((article) => !article.draft));
    nextUrl = payload.next_page || "";
  }

  let synced = 0;
  let skipped = 0;

  for (const article of articles) {
    const sourceFile = `zendesk_article_${article.id}.txt`;
    const body = stripHtml(article.body || "");

    if (!body) {
      skipped++;
      continue;
    }

    await uploadAndProcess(workspaceId, body, sourceFile);
    synced++;
  }

  return {
    articles_synced: synced,
    articles_skipped: skipped,
    total_articles: articles.length,
    message: `Synced ${synced} Zendesk Help Center articles.`,
  };
}
