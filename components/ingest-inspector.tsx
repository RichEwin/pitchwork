"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useIngest,
  type ActiveJob,
  type IngestStage,
} from "@/lib/ingest/context";

const STAGES: { stage: IngestStage; label: string }[] = [
  { stage: "parse", label: "Parse" },
  { stage: "metadata", label: "Metadata" },
  { stage: "chunk", label: "Chunk" },
  { stage: "embed", label: "Embed" },
  { stage: "store", label: "Store" },
];

type StageStatus = "pending" | "running" | "done" | "failed";

function stageStatus(active: ActiveJob, target: IngestStage): StageStatus {
  const entry = active.history.find((h) => h.stage === target);
  const last = active.history[active.history.length - 1];
  const isLast = last?.stage === target;

  if (!entry) return "pending";
  if (entry.endedAt) {
    return active.event.status === "failed" && isLast ? "failed" : "done";
  }
  return active.event.status === "failed" ? "failed" : "running";
}

function stageDuration(active: ActiveJob, target: IngestStage): number | undefined {
  const entry = active.history.find((h) => h.stage === target);
  if (!entry?.endedAt) return undefined;
  return entry.endedAt - entry.startedAt;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="size-5 text-foreground" aria-label="done" />;
    case "running":
      return <Loader2 className="size-5 animate-spin text-foreground" aria-label="running" />;
    case "failed":
      return <XCircle className="size-5 text-destructive" aria-label="failed" />;
    default:
      return <Circle className="size-5 text-muted-foreground/50" aria-label="pending" />;
  }
}

export function IngestInspector() {
  const { active } = useIngest();

  if (!active) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 pb-6 text-center">
        <p className="text-sm text-muted-foreground">
          Drop a PDF in the Ingest tab to see the pipeline.
        </p>
      </div>
    );
  }

  const totalDuration = active.event.status === "done" || active.event.status === "failed"
    ? Date.now() - active.startedAt
    : null;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
      <div className="space-y-0.5 text-sm">
        <div className="font-medium truncate">{active.filename}</div>
        <div className="text-xs text-muted-foreground">
          {active.event.status === "done" && totalDuration
            ? `Done in ${formatDuration(totalDuration)}`
            : active.event.status === "failed" && totalDuration
              ? `Failed after ${formatDuration(totalDuration)}`
              : active.event.status === "pending"
                ? "Queued…"
                : "Running…"}
        </div>
      </div>

      {active.event.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {active.event.error}
        </p>
      )}

      <ol className="space-y-2">
        {STAGES.map(({ stage, label }, i) => {
          const status = stageStatus(active, stage);
          const duration = stageDuration(active, stage);
          const detail = active.event.stage === stage ? active.event.detail : undefined;
          const percent = active.event.stage === stage ? active.event.percent : undefined;
          const isActive = status === "running";

          return (
            <li
              key={stage}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors",
                isActive && "border-foreground/30 bg-muted/40",
                status === "pending" && "opacity-60",
              )}
            >
              <div className="pt-0.5">
                <StageIcon status={status} />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {label}
                  </span>
                  {duration !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(duration)}
                    </span>
                  )}
                </div>
                {detail && (
                  <div className="text-xs text-muted-foreground truncate">{detail}</div>
                )}
                {isActive && percent !== undefined && stage === "embed" && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
