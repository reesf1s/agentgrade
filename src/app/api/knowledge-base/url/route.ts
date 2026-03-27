import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { uploadAndProcess } from "@/lib/knowledge-base";

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

/**
 * POST /api/knowledge-base/url
 * Body: { url: string, title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const titleOverride = typeof body.title === "string" ? body.title.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http(s) URLs are supported" }, { status: 400 });
    }

    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "AgentGradeKBFetcher/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL (${response.status})` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const text = stripHtml(html);

    if (!text) {
      return NextResponse.json({ error: "No readable text found at URL" }, { status: 400 });
    }

    const title =
      titleOverride ||
      parsed.hostname.replace(/^www\./, "") + parsed.pathname.replace(/[^\w/-]+/g, "-");

    const result = await uploadAndProcess(
      ctx.workspace.id,
      text,
      `${title}.url.txt`
    );

    return NextResponse.json({
      success: true,
      source: parsed.toString(),
      title: result.title,
      chunks_created: result.chunksCreated,
    });
  } catch (error) {
    console.error("knowledge-base url ingest error:", error);
    return NextResponse.json({ error: "Failed to ingest URL" }, { status: 500 });
  }
}
