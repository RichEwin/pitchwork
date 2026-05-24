import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, title, artist, album, year, metadata, created_at, raw_text")
    .eq("id", id)
    .single();

  if (docError || !document) {
    return NextResponse.json(
      { error: docError?.message ?? "not found" },
      { status: 404 },
    );
  }

  const { data: chunks, error: chunkError } = await supabase
    .from("chunks")
    .select("id, chunk_index, content, token_count")
    .eq("document_id", id)
    .order("chunk_index", { ascending: true });

  if (chunkError) {
    return NextResponse.json({ error: chunkError.message }, { status: 500 });
  }

  return NextResponse.json({ document, chunks: chunks ?? [] });
}
