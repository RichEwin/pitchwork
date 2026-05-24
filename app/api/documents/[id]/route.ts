import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "pdfs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: doc, error: lookupErr } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (lookupErr || !doc) {
    return NextResponse.json(
      { error: lookupErr?.message ?? "not found" },
      { status: 404 },
    );
  }

  if (doc.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  }

  await supabase.from("ingest_jobs").delete().eq("document_id", id);

  const { error: delErr } = await supabase.from("documents").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
