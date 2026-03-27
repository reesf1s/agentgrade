import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptSecret } from "@/lib/secrets";
import { uploadAndProcess } from "@/lib/knowledge-base";
import { syncZendeskHelpCenter } from "@/lib/integrations/zendesk";

/**
 * POST /api/knowledge-base/sync
 * Syncs knowledge base articles from Intercom Help Center.
 * Requires an active Intercom connection with API key.
 *
 * Fetches published articles from the Intercom Articles API,
 * chunks them, and stores in knowledge_base.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const body = await request.json().catch(() => ({}));
    const requestedPlatform =
      body && typeof body.platform === "string" ? body.platform : null;

    // Find active supported connection with API key
    const { data: connections } = await supabaseAdmin
      .from("agent_connections")
      .select("id, platform, api_key_encrypted, config")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .in("platform", requestedPlatform ? [requestedPlatform] : ["intercom", "zendesk"])
      .order("created_at", { ascending: false });

    const connection =
      connections?.find((item) => item.platform === requestedPlatform) ||
      connections?.find((item) => item.platform === "intercom") ||
      connections?.find((item) => item.platform === "zendesk");

    if (!connection?.api_key_encrypted) {
      return NextResponse.json(
        { error: "No active Intercom or Zendesk connection with API key found. Add one in connection settings." },
        { status: 400 }
      );
    }

    const apiKey = await decryptSecret(connection.api_key_encrypted);

    if (connection.platform === "zendesk") {
      const result = await syncZendeskHelpCenter({
        workspaceId,
        config: (connection.config || {}) as { subdomain?: string; email?: string },
        apiKey,
      });
      await supabaseAdmin
        .from("agent_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connection.id);

      return NextResponse.json({
        success: true,
        platform: "zendesk",
        ...result,
      });
    }

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
      const sourceFile = `intercom_article_${article.id}.txt`;

      // Strip HTML from article body
      const plainText = stripHtml(article.body || "");
      if (!plainText.trim()) {
        skipped++;
        continue;
      }

      await uploadAndProcess(workspaceId, plainText, sourceFile);

      synced++;
    }

    await supabaseAdmin
      .from("agent_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return NextResponse.json({
      success: true,
      platform: "intercom",
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
