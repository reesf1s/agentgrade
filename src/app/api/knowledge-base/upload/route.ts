import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const CHUNK_SIZE = 1000; // characters per chunk (overlap via sentence boundaries)
const CHUNK_OVERLAP = 100;

/**
 * POST /api/knowledge-base/upload
 * Uploads a file (PDF, .txt, .md, .json) to the knowledge base.
 * Chunks the content and optionally generates embeddings via OpenAI.
 *
 * Content-Type: multipart/form-data
 * Form fields:
 *   file  — the file to upload
 *   title — optional title override
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titleOverride = (formData.get("title") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "file field is required" }, { status: 400 });
    }

    const fileName = file.name;
    const fileText = await extractTextFromFile(file);

    if (!fileText.trim()) {
      return NextResponse.json({ error: "No readable text could be extracted from this file" }, { status: 400 });
    }

    // Parse content based on file type
    let content: string;
    let title: string;

    if (fileName.endsWith(".json")) {
      try {
        const parsed = JSON.parse(fileText);
        // Support array of { title, content } or flat object
        if (Array.isArray(parsed)) {
          const chunks = parsed.filter((item) => item.content || item.text);
          if (chunks.length === 0) {
            return NextResponse.json({ error: "JSON must be an array of { title, content } objects" }, { status: 400 });
          }
          // Insert each item as a separate KB entry
          const rows = chunks.flatMap((item, i) => chunkText(item.content || item.text || "").map((chunk, j) => ({
            workspace_id: ctx.workspace.id,
            title: item.title || titleOverride || `${fileName} — Item ${i + 1}`,
            content: chunk,
            chunk_index: j,
            source_file: fileName,
          })));

          const { error } = await supabaseAdmin.from("ag_knowledge_base_items").insert(rows);
          if (error) {
            return NextResponse.json({ error: "Failed to store knowledge base items" }, { status: 500 });
          }

          return NextResponse.json({ success: true, chunks_created: rows.length, source: fileName });
        } else {
          content = JSON.stringify(parsed, null, 2);
          title = titleOverride || fileName.replace(/\.[^.]+$/, "");
        }
      } catch {
        return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
      }
    } else {
      content = fileText;
      title = titleOverride || fileName.replace(/\.[^.]+$/, "");
    }

    // Chunk the content
    const chunks = chunkText(content);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No content could be extracted from file" }, { status: 400 });
    }

    // Generate embeddings if OpenAI API key is configured
    let embeddings: number[][] | null = null;
    if (process.env.OPENAI_API_KEY) {
      try {
        embeddings = await generateEmbeddings(chunks);
      } catch (err) {
        console.warn("Embedding generation failed, storing without embeddings:", err);
      }
    }

    // Build rows with optional embeddings
    const rows = chunks.map((chunk, i) => ({
      workspace_id: ctx.workspace.id,
      title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
      content: chunk,
      chunk_index: i,
      source_file: fileName,
      ...(embeddings?.[i] ? { embedding: embeddings[i] } : {}),
    }));

    // Delete any existing chunks from this file before inserting new ones
    await supabaseAdmin
      .from("ag_knowledge_base_items")
      .delete()
      .eq("workspace_id", ctx.workspace.id)
      .eq("source_file", fileName);

    const { error } = await supabaseAdmin.from("ag_knowledge_base_items").insert(rows);

    if (error) {
      console.error("Failed to store KB items:", error);
      return NextResponse.json({ error: "Failed to store knowledge base items" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      chunks_created: chunks.length,
      source: fileName,
      title,
      embeddings_generated: embeddings !== null,
    });
  } catch (error) {
    console.error("Knowledge base upload error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.startsWith("Unsupported file type") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });

    try {
      const parsed = await parser.getText();
      return parsed.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  if (fileName.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value.trim();
  }

  if (
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".json")
  ) {
    return (await file.text()).trim();
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, TXT, Markdown, or JSON.");
}

// ─── Text chunking ────────────────────────────────────────────────────────────

/**
 * Splits text into overlapping chunks at sentence boundaries.
 * Tries to keep chunks under CHUNK_SIZE characters.
 */
function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= CHUNK_SIZE) return cleaned ? [cleaned] : [];

  // Split on sentence-ish boundaries
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: keep last CHUNK_OVERLAP chars as context for next chunk
      current = current.slice(-CHUNK_OVERLAP) + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 50); // skip tiny chunks
}

// ─── OpenAI embeddings ────────────────────────────────────────────────────────

async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: chunks,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}
