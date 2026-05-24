import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";

import { runIngestJob } from "@/lib/ingest/worker";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "pdfs";

async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: "50MB",
    allowedMimeTypes: ["application/pdf"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "only application/pdf is accepted" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    await ensureBucket(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bucket setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const documentId = randomUUID();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${documentId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: docError } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      title: file.name,
      storage_path: storagePath,
      source_type: "pdf",
    });

  if (docError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  const { data: job, error: jobError } = await supabase
    .from("ingest_jobs")
    .insert({
      document_id: documentId,
      status: "pending",
      progress: {},
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? "failed to create job" },
      { status: 500 },
    );
  }

  after(async () => {
    try {
      await runIngestJob(job.id);
    } catch (err) {
      console.error(`[ingest] worker crashed for job ${job.id}:`, err);
    }
  });

  return NextResponse.json({ jobId: job.id, documentId });
}
