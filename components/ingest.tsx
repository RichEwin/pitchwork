"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useIngest, type IngestStatus } from "@/lib/ingest/context";

type RecentJob = {
  id: string;
  status: IngestStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
  document: {
    id: string;
    title: string;
    artist: string | null;
    album: string | null;
  } | null;
};

const STATUS_VARIANT: Record<IngestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  running: "default",
  done: "outline",
  failed: "destructive",
};

export function Ingest() {
  const { active, startJob } = useIngest();
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refreshRecent = useCallback(async () => {
    try {
      const r = await fetch("/api/ingest/recent", { cache: "no-store" });
      if (!r.ok) return;
      const json = (await r.json()) as { jobs: RecentJob[] };
      setRecent(json.jobs);
    } catch {}
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (active?.event.status === "done" || active?.event.status === "failed") {
      refreshRecent();
    }
  }, [active?.event.status, refreshRecent]);

  const busy = uploading || (active?.event.status === "pending" || active?.event.status === "running");

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploadError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const r = await fetch("/api/upload", { method: "POST", body: form });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "upload failed");
        startJob({ jobId: json.jobId, documentId: json.documentId, filename: file.name });
        refreshRecent();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "upload failed");
      } finally {
        setUploading(false);
      }
    },
    [startJob, refreshRecent],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
    disabled: busy,
  });

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-8 py-12 text-center transition-colors",
          isDragActive && "border-foreground/40 bg-muted/60",
          busy && "pointer-events-none opacity-60",
          !busy && !isDragActive && "hover:bg-muted/40 cursor-pointer",
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {busy
              ? uploading
                ? "Uploading…"
                : `Processing ${active?.filename ?? "PDF"}…`
              : isDragActive
                ? "Drop the PDF here"
                : "Drop a PDF here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">One PDF at a time.</p>
        </div>
      </div>

      {uploadError && (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent uploads
        </h3>
        {recent.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nothing uploaded yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recent.map((job) => (
              <li key={job.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {job.document?.title ?? "(missing document)"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[job.document?.artist, job.document?.album].filter(Boolean).join(" · ") ||
                      formatTime(job.created_at)}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[job.status as IngestStatus] ?? "secondary"}>
                  {job.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
