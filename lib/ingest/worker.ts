import Anthropic from "@anthropic-ai/sdk";
import { getEncoding } from "js-tiktoken";
import OpenAI from "openai";
import { extractText } from "unpdf";

import { createServiceClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];

const BUCKET = "pdfs";
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const EMBED_BATCH = 32;
const EMBED_MODEL = "text-embedding-3-small";
const METADATA_MODEL = "claude-sonnet-4-6";
const METADATA_INPUT_CHARS = 6000;

type Stage = "parse" | "metadata" | "chunk" | "embed" | "store";

type Progress = {
  stage: Stage;
  percent: number;
  detail: string;
};

type ExtractedMetadata = {
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  publication: string | null;
  reviewer: string | null;
};

const METADATA_TOOL: Anthropic.Tool = {
  name: "extract_metadata",
  description: "Extract metadata from a piece of music writing. Use null for any field not explicit in the text.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: ["string", "null"] },
      artist: { type: ["string", "null"] },
      album: { type: ["string", "null"] },
      year: { type: ["integer", "null"] },
      publication: { type: ["string", "null"] },
      reviewer: { type: ["string", "null"] },
    },
    required: ["title", "artist", "album", "year", "publication", "reviewer"],
    additionalProperties: false,
  },
};

export async function runIngestJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  const setProgress = async (progress: Progress) => {
    await supabase
      .from("ingest_jobs")
      .update({
        status: "running",
        progress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  };

  try {
    const { data: job, error: jobError } = await supabase
      .from("ingest_jobs")
      .select("id, document_id")
      .eq("id", jobId)
      .single();
    if (jobError || !job?.document_id) {
      throw new Error(`job not found: ${jobError?.message ?? "missing document_id"}`);
    }

    const documentId = job.document_id;

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .single();
    if (docError || !doc?.storage_path) {
      throw new Error(`document not found: ${docError?.message ?? "missing storage_path"}`);
    }

    await setProgress({ stage: "parse", percent: 0, detail: "downloading PDF" });

    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(doc.storage_path);
    if (dlError || !blob) throw new Error(`storage download failed: ${dlError?.message}`);

    const pdfBytes = new Uint8Array(await blob.arrayBuffer());

    await setProgress({ stage: "parse", percent: 50, detail: "extracting text" });

    const { totalPages, text } = await extractText(pdfBytes, { mergePages: true });
    if (!text.trim()) {
      throw new Error("PDF contained no extractable text");
    }

    const { error: rawErr } = await supabase
      .from("documents")
      .update({ raw_text: text })
      .eq("id", documentId);
    if (rawErr) throw new Error(`failed to save raw_text: ${rawErr.message}`);

    await setProgress({
      stage: "parse",
      percent: 100,
      detail: `${totalPages} pages, ${text.length} chars`,
    });

    await setProgress({ stage: "metadata", percent: 0, detail: "asking Claude" });

    const anthropic = new Anthropic();
    const metaResponse = await anthropic.messages.create({
      model: METADATA_MODEL,
      max_tokens: 512,
      tools: [METADATA_TOOL],
      tool_choice: { type: "tool", name: "extract_metadata" },
      messages: [{ role: "user", content: text.slice(0, METADATA_INPUT_CHARS) }],
    });

    const toolUse = metaResponse.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) throw new Error("Claude did not return a tool_use block for metadata");

    const extracted = toolUse.input as ExtractedMetadata;

    const docUpdate: DocumentUpdate = {};
    if (extracted.title) docUpdate.title = extracted.title;
    if (extracted.artist) docUpdate.artist = extracted.artist;
    if (extracted.album) docUpdate.album = extracted.album;
    if (extracted.year) docUpdate.year = extracted.year;

    const docMeta: Record<string, Json> = {};
    if (extracted.publication) docMeta.publication = extracted.publication;
    if (extracted.reviewer) docMeta.reviewer = extracted.reviewer;
    if (Object.keys(docMeta).length > 0) docUpdate.metadata = docMeta;

    if (Object.keys(docUpdate).length > 0) {
      const { error: metaErr } = await supabase
        .from("documents")
        .update(docUpdate)
        .eq("id", documentId);
      if (metaErr) throw new Error(`failed to save metadata: ${metaErr.message}`);
    }

    await setProgress({
      stage: "metadata",
      percent: 100,
      detail: extracted.title ? `"${extracted.title}"` : "no fields extracted",
    });

    await setProgress({ stage: "chunk", percent: 0, detail: "tokenising" });

    const enc = getEncoding("cl100k_base");
    const allTokens = enc.encode(text);
    const chunks: { content: string; token_count: number }[] = [];
    const step = CHUNK_SIZE - CHUNK_OVERLAP;

    for (let i = 0; i < allTokens.length; i += step) {
      const slice = allTokens.slice(i, i + CHUNK_SIZE);
      chunks.push({ content: enc.decode(slice), token_count: slice.length });
      if (i + CHUNK_SIZE >= allTokens.length) break;
    }

    if (chunks.length === 0) throw new Error("text produced zero chunks");

    await setProgress({
      stage: "chunk",
      percent: 100,
      detail: `${chunks.length} chunks (~${CHUNK_SIZE} tok, ${CHUNK_OVERLAP} overlap)`,
    });

    await setProgress({ stage: "embed", percent: 0, detail: `0/${chunks.length}` });

    const openai = new OpenAI();
    const embeddings: string[] = [];
    const totalBatches = Math.ceil(chunks.length / EMBED_BATCH);

    for (let b = 0; b < totalBatches; b++) {
      const batch = chunks.slice(b * EMBED_BATCH, (b + 1) * EMBED_BATCH);
      const response = await openai.embeddings.create({
        model: EMBED_MODEL,
        input: batch.map((c) => c.content),
      });
      for (const item of response.data) {
        embeddings.push(JSON.stringify(item.embedding));
      }
      await setProgress({
        stage: "embed",
        percent: Math.round((embeddings.length / chunks.length) * 100),
        detail: `${embeddings.length}/${chunks.length}`,
      });
    }

    await setProgress({ stage: "store", percent: 0, detail: "inserting chunks" });

    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      chunk_index: i,
      content: c.content,
      token_count: c.token_count,
      embedding: embeddings[i],
    }));

    const { error: insertErr } = await supabase.from("chunks").insert(rows);
    if (insertErr) throw new Error(`chunk insert failed: ${insertErr.message}`);

    await supabase
      .from("ingest_jobs")
      .update({
        status: "done",
        progress: {
          stage: "store",
          percent: 100,
          detail: `${chunks.length} chunks stored`,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // TODO(prod): replace after() fire-and-forget with a polling worker process.
    // TODO(retry): single attempt only; any transient failure marks the job failed.
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] job ${jobId} failed:`, message);
    await supabase
      .from("ingest_jobs")
      .update({
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}
