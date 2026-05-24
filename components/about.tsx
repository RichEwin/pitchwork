import { Card, CardContent } from "@/components/ui/card";

export function About() {
  return (
    <Card>
      <CardContent className="space-y-8 py-2 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">The idea</h2>
          <p className="text-muted-foreground">
            Pitchwork is a RAG (retrieval-augmented generation) system over a corpus of
            music criticism — reviews, interviews, profiles. Ask a question, get an
            answer grounded in actual passages with citations back to the source.
          </p>
          <p className="text-muted-foreground">
            The goal isn{"’"}t just to answer well. It{"’"}s to show the pipeline.
            Every retrieval, every chunk, every prompt is inspectable from the drawer
            on the right. RAG demos hide a lot; this one doesn{"’"}t.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">Architecture</h2>
          <p className="text-muted-foreground">
            Three layers, all stitched together in the Next.js app:
          </p>
          <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground marker:text-muted-foreground/60">
            <li>
              <span className="text-foreground">Storage.</span> Postgres on Supabase,
              with <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pgvector</code> for
              embeddings. Three tables — <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">documents</code>,
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs"> chunks</code> (with{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">vector(1536)</code>),
              and <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ingest_jobs</code>{" "}
              — plus a <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">match_chunks</code> SQL
              function that does the cosine-similarity search.
            </li>
            <li>
              <span className="text-foreground">App.</span> Next.js 16 App Router.
              Route handlers run the embed → retrieve → synthesise pipeline server-side.
              The UI is shadcn/ui on Base UI primitives, Tailwind v4 for everything else.
            </li>
            <li>
              <span className="text-foreground">Models.</span> OpenAI for embeddings
              (<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">text-embedding-3-small</code>,
              1536 dims), Anthropic for answer synthesis. Streamed to the client over SSE.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">The pipeline</h2>
          <ol className="ml-5 list-decimal space-y-2 text-muted-foreground marker:text-muted-foreground/60">
            <li>
              <span className="text-foreground">Ingest.</span> Upload a document. It
              gets split into roughly 500-token chunks, each chunk embedded, then
              persisted. Job state lives in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ingest_jobs</code> so
              the UI can show progress over Supabase Realtime.
            </li>
            <li>
              <span className="text-foreground">Retrieve.</span> Embed the question,
              call <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">match_chunks</code> with
              optional artist/year filters, get the top-k passages back ranked by
              cosine similarity.
            </li>
            <li>
              <span className="text-foreground">Synthesise.</span> Top-k chunks plus
              the question go to the LLM. The answer streams back with chunk IDs as
              citations so the UI can render inline source markers.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">The four tabs</h2>
          <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground marker:text-muted-foreground/60">
            <li><span className="text-foreground">Ask</span> — the actual chat surface.</li>
            <li><span className="text-foreground">Library</span> — what{"’"}s in the corpus, down to individual chunks.</li>
            <li><span className="text-foreground">Ingest</span> — drop in new sources, watch them chunk and embed.</li>
            <li><span className="text-foreground">Evals</span> — retrieval recall and answer quality against a held-out question set.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">Where it is right now</h2>
          <p className="text-muted-foreground">
            Stage 1: scaffolding. The schema is real, the four-tab shell renders, the
            inspector drawer opens. None of the pipeline is wired yet — that{"’"}s
            stages 2 and 3.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
