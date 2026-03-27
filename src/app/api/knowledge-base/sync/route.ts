import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/knowledge-base/sync
 * Syncs knowledge base articles from Intercom Help Center.
 * Requires an active Intercom connection with API key.
 *
 * Fetches published articles from the Intercom Articles API,
 * chunks them, and stores in knowledge_base.
 */
export async function POST() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;

    // Find active Intercom connection with API key
    const { data: connections } = await supabaseAdmin
      .from("agent_connections")
      .select("id, api_key_encrypted")
      .eq("workspace_id", workspaceId)
      .eq("platform", "intercom")
      .eq("is_active", true)
      .limit(1);

    const connection = connections?.[0];

    if (!connection?.api_key_encrypted) {
      return NextResponse.json(
        { error: "No active Intercom connection with API key found. Add your Intercom API key in connection settings." },
        { status: 400 }
      );
    }

    const apiKey = connection.api_key_encrypted;

    // Fetch published articles from Intercom
    const articles: IntercomArticle[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // max 10 pages = 250 articles
      const response = await fetch(
        `https://api.intercom.io/articles?state=published&per_page=25&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
            "Intercom-Version": "2.10",
          },
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json(
          { error: `Intercom API error: ${response.status}`, details: errText },
          { status: 500 }
        );
      }

      const data = await response.json();
      const pageArticles: IntercomArticle[] = data.data || [];
      articles.push(...pageArticles);

      hasMore = pageArticles.length === 25;
      page++;
    }

    if (articles.length === 0) {
      return NextResponse.json({ success: true, articles_synced: 0, message: "No published articles found in Intercom." });
    }

    let synced = 0;
    let skipped = 0;

    for (const article of articles) {
      const sourceUrl = `https://help.intercom.com/en/articles/${article.id}`;

      // Skip if this article URL is already in the KB
      const { data: existing } = await supabaseAdmin
        .from("knowledge_base")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("source_url", sourceUrl)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Strip HTML from article body
      const plainText = stripHtml(article.body || "");
      if (!plainText.trim()) continue;

      // Chunk the article
      const chunks = chunkText(plainText);

      // Delete old versions of this article (by URL)
      await supabaseAdmin
        .from("knowledge_base")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("source_url", sourceUrl);

      // Insert chunks
      await supabaseAdmin.from("knowledge_base").insert(
        chunks.map((chunk, i) => ({
          workspace_id: workspaceId,
          title: article.title,
          content: chunk,
          chunk_index: i,
          source_url: sourceUrl,
          source_type: "intercom" as const,
        }))
      );

      synced++;
    }

    return NextResponse.json({
      success: true,
      articles_synced: synced,
      articles_skipped: skipped,
      total_articles: articles.length,
      message: `Synced ${synced} articles from Intercom Help Center.`,
    });
  } catch (error) {
    console.error("KB sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntercomArticle {
  id: string;
  title: string;
  body: string;
  state: string;
  url?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string): string[] {
  const CHUNK_SIZE = 1000;
  const CHUNK_OVERLAP = 100;

  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (cleaned.length <= CHUNK_SIZE) return cleaned ? [cleaned] : [];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP) + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 50);
}
