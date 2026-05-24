import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 500;

type ProgressShape = {
  stage?: "parse" | "metadata" | "chunk" | "embed" | "store";
  percent?: number;
  detail?: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const supabase = createServiceClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastSent = "";

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      const emit = (payload: unknown) => {
        const serialised = JSON.stringify(payload);
        if (serialised === lastSent) return;
        controller.enqueue(encoder.encode(`data: ${serialised}\n\n`));
        lastSent = serialised;
      };

      request.signal.addEventListener("abort", close);

      while (!closed && !request.signal.aborted) {
        const { data, error } = await supabase
          .from("ingest_jobs")
          .select("status, progress, error")
          .eq("id", jobId)
          .single();

        if (error || !data) {
          emit({
            status: "failed",
            stage: null,
            percent: 0,
            detail: "",
            error: error?.message ?? "job not found",
          });
          close();
          break;
        }

        const progress = (data.progress ?? {}) as ProgressShape;

        emit({
          status: data.status,
          stage: progress.stage ?? null,
          percent: progress.percent ?? 0,
          detail: progress.detail ?? "",
          ...(data.error ? { error: data.error } : {}),
        });

        if (data.status === "done" || data.status === "failed") {
          close();
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
    },
  });
}
