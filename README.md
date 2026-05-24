# Pitchwork

A music criticism RAG with a live pipeline inspector.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui
- **Database:** Supabase (Postgres + pgvector)
- **Streaming:** Server-Sent Events
- **LLM / embeddings:** OpenAI `text-embedding-3-small`, Anthropic `claude-sonnet-4-6`

## Status

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Foundations & scaffolding | ✅ |
| 2 | Document upload & ingest pipeline | ✅ |
| 3 | Query pipeline & chat | ⏳ |
| 4 | Evaluation harness | ⏳ |
| 5 | Polish, deploy & writeup | ⏳ |

## Stage 1 notes

Set up Next.js App Router with shadcn/ui on Base UI primitives. Wired Supabase with pgvector enabled and the initial schema (`documents`, `chunks`, `ingest_jobs`) plus a `match_chunks` function for vector search. Built the four-tab app shell (Ask / Library / Ingest / Evals) and a right-side inspector drawer using the shadcn `Sheet` component. Dark mode wired to system preference.

## Stage 2 notes

End-to-end PDF ingest. Drop a PDF on the Ingest tab and the right-side inspector animates through five stages:

1. **Parse** — download from Supabase Storage, extract text with `unpdf`, persist to `documents.raw_text`.
2. **Metadata** — one Claude call with a tool-schema-forced response extracts `{title, artist, album, year, publication, reviewer}` from the first ~6k chars. Nullable; no fabrication.
3. **Chunk** — `js-tiktoken` (`cl100k_base`) splits the text into ~800-token chunks with 100-token overlap.
4. **Embed** — chunks go through OpenAI `text-embedding-3-small` in batches of 32; progress updates per batch.
5. **Store** — chunks insert into `chunks` with their 1536-dim vectors, job marked `done`.

Server-only data access — every route uses the service role client, no browser-direct Supabase reads. The worker fires from the upload route via `next/server`'s `after()` (TODO: replace with a polling worker process for prod). Progress is exposed to the UI via an SSE route that polls `ingest_jobs` every 500ms; the subscription lives in a React Context at the app root so it survives drawer open/close. The Library tab renders documents in a sortable shadcn `Table`; clicking a row opens a left-side `Sheet` listing every chunk.

## Local dev

```bash
pnpm install
cp .env.example .env.local  # fill in Supabase + OpenAI + Anthropic values
pnpm db:push                # apply migrations
pnpm dev
```
