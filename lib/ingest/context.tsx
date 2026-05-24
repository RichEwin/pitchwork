"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type IngestStage = "parse" | "metadata" | "chunk" | "embed" | "store";
export type IngestStatus = "pending" | "running" | "done" | "failed";

export type IngestEvent = {
  status: IngestStatus;
  stage: IngestStage | null;
  percent: number;
  detail: string;
  error?: string;
};

export type ActiveJob = {
  jobId: string;
  documentId: string;
  filename: string;
  startedAt: number;
  event: IngestEvent;
  history: { stage: IngestStage; startedAt: number; endedAt?: number }[];
};

type IngestContextValue = {
  active: ActiveJob | null;
  startJob: (input: { jobId: string; documentId: string; filename: string }) => void;
};

const IngestContext = createContext<IngestContextValue | null>(null);

export function IngestProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveJob | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, []);

  const startJob = useCallback(
    ({ jobId, documentId, filename }: { jobId: string; documentId: string; filename: string }) => {
      sourceRef.current?.close();

      const startedAt = Date.now();
      setActive({
        jobId,
        documentId,
        filename,
        startedAt,
        event: { status: "pending", stage: null, percent: 0, detail: "" },
        history: [],
      });

      const es = new EventSource(`/api/ingest/${jobId}/stream`);
      sourceRef.current = es;

      es.onmessage = (raw) => {
        try {
          const event = JSON.parse(raw.data) as IngestEvent;
          setActive((prev) => {
            if (!prev || prev.jobId !== jobId) return prev;

            let history = prev.history;
            if (event.stage && event.stage !== prev.event.stage) {
              const now = Date.now();
              history = [...history];
              const last = history[history.length - 1];
              if (last && !last.endedAt) last.endedAt = now;
              history.push({ stage: event.stage, startedAt: now });
            }
            if ((event.status === "done" || event.status === "failed") && history.length > 0) {
              const last = history[history.length - 1];
              if (last && !last.endedAt) last.endedAt = Date.now();
            }

            return { ...prev, event, history };
          });

          if (event.status === "done" || event.status === "failed") {
            es.close();
            sourceRef.current = null;
          }
        } catch (err) {
          console.error("[ingest-context] bad SSE payload", err);
        }
      };

      es.onerror = () => {
        es.close();
        sourceRef.current = null;
      };
    },
    [],
  );

  return (
    <IngestContext.Provider value={{ active, startJob }}>{children}</IngestContext.Provider>
  );
}

export function useIngest() {
  const ctx = useContext(IngestContext);
  if (!ctx) throw new Error("useIngest must be used within IngestProvider");
  return ctx;
}
