/**
 * Knowledge Base Manager
 *
 * Handles document ingestion, chunking, embedding generation, and
 * pgvector semantic search. Used to provide relevant context to the
 * Claude scoring engine during evaluation.
 *
 * Requires:
 *   OPENAI_API_KEY — for text-embedding-3-small (1536-dim vectors)
 *
 * pgvector search requires this SQL function in Supabase:
 *   See schema.sql → match_knowledge_base()
 */

import { supabaseAdmin } from "@/lib/supabase";
import type { KnowledgeBaseItem } from "@/lib/db/types";

// ─── Chunking Config ────────────────────────────────────────────────
// ~500 tokens ≈ 2000 characters (rough 4 chars/token estimate)
const CHUNK_SIZE_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200; // overlap prevents context loss at boundaries

// ─── Document Chunking ──────────────────────────────────────────────
/**
 * Splits a document into ~500-token chunks with overlap.
 * Respects paragraph boundaries where possible to preserve context.
 *
 * Returns array of { title, content, chunk_index } ready for embedding.
 */
export function chunkDocument(
  content: string,
  title: string
): { title: string; content: string; chunk_index: number }[] {
  const chunks: { title: string; content: string; chunk_index: number }[] = [];

  // Split on paragraph breaks first, then re-join into chunks
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size, save current chunk and start new one
    if (currentChunk.length + paragraph.length > CHUNK_SIZE_CHARS && currentChunk.length > 0) {
      chunks.push({
        title: `${title} (part ${chunkIndex + 1})`,
        content: currentChunk.trim(),
        chunk_index: chunkIndex,
      });
      chunkIndex++;

      // Start next chunk with overlap: take the tail of the previous chunk
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP_CHARS);
      currentChunk = currentChunk.slice(overlapStart) + "\n\n" + paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + paragraph : paragraph;
    }
  }

  // Save the final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      title: chunkIndex === 0 ? title : `${title} (part ${chunkIndex + 1})`,
      content: currentChunk.trim(),
      chunk_index: chunkIndex,
    });
  }

  return chunks;
}

// ─── Embedding Generation ───────────────────────────────────────────
/**
 * Generates a 1536-dimensional embedding via OpenAI text-embedding-3-small.
 * Uses fetch directly — no openai package required.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Truncate to ~8000 chars to stay within model limits (8191 tokens)
  const input = text.slice(0, 32000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embeddings API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

// ─── pgvector Semantic Search ───────────────────────────────────────
/**
 * Searches the knowledge base using pgvector cosine similarity.
 * Requires the match_knowledge_base() SQL function (see schema.sql).
 *
 * Falls back to empty array if:
 *   - OPENAI_API_KEY not set
 *   - pgvector function not found
 *   - No documents have embeddings
 */
export async function searchKnowledgeBase(
  workspaceId: string,
  query: string,
  topK = 5
): Promise<KnowledgeBaseItem[]> {
  if (!process.env.OPENAI_API_KEY) {
    // Can't search without embeddings — return empty (scorer works without KB)
    return [];
  }

  try {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Call pgvector similarity search via Supabase RPC
    const { data, error } = await supabaseAdmin.rpc("match_knowledge_base", {
      p_workspace_id: workspaceId,
      p_query_embedding: queryEmbedding,
      p_match_count: topK,
    });

    if (error) {
      // RPC might not exist yet — log and degrade gracefully
      console.warn("[knowledge-base] pgvector search failed:", error.message);
      return [];
    }

    return (data || []) as KnowledgeBaseItem[];
  } catch (error) {
    console.warn("[knowledge-base] Search error:", error);
    return [];
  }
}

// ─── Store Chunks with Embeddings ───────────────────────────────────
/**
 * Embeds and stores an array of chunks into the knowledge_base table.
 * Processes chunks sequentially to avoid OpenAI rate limits.
 */
async function storeChunks(
  workspaceId: string,
  chunks: { title: string; content: string; chunk_index: number }[],
  sourceFile?: string
): Promise<void> {
  for (const chunk of chunks) {
    let embedding: number[] | null = null;

    try {
      embedding = await generateEmbedding(`${chunk.title}\n\n${chunk.content}`);
    } catch (e) {
      // Store chunk without embedding — search won't find it but it's preserved
      console.warn(`[knowledge-base] Embedding failed for chunk ${chunk.chunk_index}:`, e);
    }

    const { error } = await supabaseAdmin.from("knowledge_base").insert({
      workspace_id: workspaceId,
      title: chunk.title,
      content: chunk.content,
      chunk_index: chunk.chunk_index,
      embedding,
      source_file: sourceFile || null,
    });

    if (error) {
      console.error(`[knowledge-base] Failed to store chunk ${chunk.chunk_index}:`, error);
    }
  }
}

// ─── Upload & Process ───────────────────────────────────────────────
/**
 * Processes a text/markdown document: chunk, embed, and store.
 * For binary formats (PDF, DOCX), pass pre-extracted text content.
 *
 * Returns the number of chunks created.
 */
export async function uploadAndProcess(
  workspaceId: string,
  content: string,
  filename: string
): Promise<{ chunksCreated: number; title: string }> {
  // Use filename (without extension) as the document title
  const title = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

  // Clean the content: normalize whitespace, remove null bytes
  const cleanContent = content
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (cleanContent.length === 0) {
    throw new Error("Document content is empty after cleaning");
  }

  // Delete existing chunks for this file (allows re-upload)
  await supabaseAdmin
    .from("knowledge_base")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("source_file", filename);

  const chunks = chunkDocument(cleanContent, title);
  await storeChunks(workspaceId, chunks, filename);

  return { chunksCreated: chunks.length, title };
}

// ─── Intercom Article Sync ──────────────────────────────────────────
/**
 * Pulls articles from the Intercom Help Center API, chunks them,
 * generates embeddings, and stores in the knowledge base.
 *
 * Requires the agent_connection to have api_key_encrypted set with
 * a valid Intercom access token.
 */
export async function syncIntercomArticles(connectionId: string): Promise<{
  articlesProcessed: number;
  chunksCreated: number;
}> {
  // Fetch the connection to get the API key and workspace
  const { data: connection, error: connError } = await supabaseAdmin
    .from("agent_connections")
    .select("workspace_id, api_key_encrypted, config")
    .eq("id", connectionId)
    .single();

  if (connError || !connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  if (!connection.api_key_encrypted) {
    throw new Error("Connection has no API key configured");
  }

  const workspaceId = connection.workspace_id as string;
  const intercomToken = connection.api_key_encrypted as string;

  // Fetch articles from Intercom API
  let articles: { id: string; title: string; body: string; state: string }[] = [];
  let nextPage: string | null = "https://api.intercom.io/articles";

  while (nextPage) {
    const pageUrl: string = nextPage;
    const pageResponse: Response = await fetch(pageUrl, {
      headers: {
        Authorization: `Bearer ${intercomToken}`,
        Accept: "application/json",
        "Intercom-Version": "2.10",
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`Intercom API error ${pageResponse.status}: ${await pageResponse.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = await pageResponse.json();
    const pageArticles = (pageData.data || []) as {
      id: string;
      title: string;
      body: string;
      state: string;
    }[];

    // Only sync published articles
    articles = articles.concat(pageArticles.filter((a) => a.state === "published"));

    // Intercom uses cursor-based pagination
    nextPage = pageData.pages?.next || null;
  }

  let totalChunks = 0;

  for (const article of articles) {
    if (!article.body || !article.title) continue;

    // Strip HTML tags from Intercom article body
    const plainText = article.body
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (plainText.length < 50) continue; // skip stub articles

    try {
      const { chunksCreated } = await uploadAndProcess(
        workspaceId,
        plainText,
        `intercom_${article.id}.txt`
      );
      totalChunks += chunksCreated;
    } catch (e) {
      console.error(`[knowledge-base] Failed to process Intercom article ${article.id}:`, e);
    }
  }

  // Update last_sync_at on the connection
  await supabaseAdmin
    .from("agent_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connectionId);

  return { articlesProcessed: articles.length, chunksCreated: totalChunks };
}
