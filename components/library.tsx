"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DocumentRow = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  metadata: { publication?: string; reviewer?: string } | null;
  created_at: string;
  chunks: { count: number }[];
};

type Chunk = {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
};

type SortKey = "artist" | "album" | "year" | "title" | "publication" | "chunks" | "created_at";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "year", label: "Year" },
  { key: "title", label: "Title" },
  { key: "publication", label: "Publication" },
  { key: "chunks", label: "Chunks" },
  { key: "created_at", label: "Added" },
];

async function deleteDocument(id: string): Promise<boolean> {
  const r = await fetch(`/api/documents/${id}`, { method: "DELETE" });
  return r.ok;
}

function getSortValue(doc: DocumentRow, key: SortKey): string | number | null {
  switch (key) {
    case "artist":
      return doc.artist;
    case "album":
      return doc.album;
    case "year":
      return doc.year;
    case "title":
      return doc.title;
    case "publication":
      return doc.metadata?.publication ?? null;
    case "chunks":
      return doc.chunks[0]?.count ?? 0;
    case "created_at":
      return doc.created_at;
  }
}

function compare(a: string | number | null, b: string | number | null, dir: SortDir): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = a < b ? -1 : 1;
  return dir === "asc" ? result : -result;
}

export function Library() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<{ document: DocumentRow; chunks: Chunk[] } | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/documents", { cache: "no-store" });
      if (!r.ok) return;
      const json = (await r.json()) as { documents: DocumentRow[] };
      setDocuments(json.documents);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (doc: DocumentRow, e: React.MouseEvent) => {
      e.stopPropagation();
      const label = [doc.artist, doc.album].filter(Boolean).join(" · ") || doc.title;
      if (!window.confirm(`Delete "${label}"? This removes the PDF, chunks, and embeddings.`)) {
        return;
      }
      setDeletingId(doc.id);
      const ok = await deleteDocument(doc.id);
      setDeletingId(null);
      if (ok) {
        if (selected?.document.id === doc.id) setSelected(null);
        refresh();
      }
    },
    [refresh, selected?.document.id],
  );

  const sorted = useMemo(() => {
    return [...documents].sort((a, b) =>
      compare(getSortValue(a, sortKey), getSortValue(b, sortKey), sortDir),
    );
  }, [documents, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "created_at" || key === "year" || key === "chunks" ? "desc" : "asc");
      return key;
    });
  }, []);

  const openDocument = useCallback(async (doc: DocumentRow) => {
    setSelected({ document: doc, chunks: [] });
    setLoadingChunks(true);
    try {
      const r = await fetch(`/api/documents/${doc.id}/chunks`, { cache: "no-store" });
      if (!r.ok) return;
      const json = (await r.json()) as { chunks: Chunk[] };
      setSelected({ document: doc, chunks: json.chunks });
    } catch {}
    finally {
      setLoadingChunks(false);
    }
  }, []);

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No documents yet. Drop a PDF in the Ingest tab.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIndicator active={sortKey === col.key} dir={sortDir} />
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-px" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((doc) => (
              <TableRow
                key={doc.id}
                onClick={() => openDocument(doc)}
                className="cursor-pointer"
              >
                <TableCell>{doc.artist ?? "—"}</TableCell>
                <TableCell>{doc.album ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{doc.year ?? "—"}</TableCell>
                <TableCell className="max-w-[24ch] truncate">{doc.title}</TableCell>
                <TableCell>{doc.metadata?.publication ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{doc.chunks[0]?.count ?? 0}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(doc.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => handleDelete(doc, e)}
                    disabled={deletingId === doc.id}
                    aria-label={`Delete ${doc.title}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="left" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.document.title ?? ""}</SheetTitle>
            <SheetDescription>
              {[
                selected?.document.artist,
                selected?.document.album,
                selected?.document.year ?? undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
            {loadingChunks ? (
              <p className="text-sm text-muted-foreground">Loading chunks…</p>
            ) : selected?.chunks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chunks for this document.</p>
            ) : (
              selected?.chunks.map((chunk) => (
                <article
                  key={chunk.id}
                  className="space-y-1.5 rounded-lg border border-border bg-card p-3"
                >
                  <header className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                    <span>chunk #{chunk.chunk_index}</span>
                    {chunk.token_count !== null && <span>{chunk.token_count} tokens</span>}
                  </header>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{chunk.content}</p>
                </article>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className={cn("size-3 text-muted-foreground/50")} />;
  return dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />;
}
