# Pitchwork

A grounded music-criticism RAG with a live pipeline inspector.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui (Base UI primitives)
- **Database:** Supabase (Postgres + pgvector)
- **State / streaming:** Server-Sent Events, Supabase Realtime
- **LLM / embeddings:** [filled in stage 2–3]

## Status

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Foundations & scaffolding | ✅ |
| 2 | Document upload & ingest pipeline | ⏳ |
| 3 | Query pipeline & chat | ⏳ |
| 4 | Evaluation harness | ⏳ |
| 5 | Polish, deploy & writeup | ⏳ |

## Stage 1 notes

Set up Next.js App Router with shadcn/ui on Base UI primitives. Wired Supabase with pgvector enabled and the initial schema (`documents`, `chunks`, `ingest_jobs`) plus a `match_chunks` function for vector search. Built the four-tab app shell and a right-side inspector drawer using the shadcn `Sheet` component. Dark mode wired to system preference.

## Local dev

```bash
pnpm install
cp .env.example .env.local  # fill in Supabase values
pnpm db:push                # apply migrations
pnpm dev
```
