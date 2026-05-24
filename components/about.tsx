import { Card, CardContent } from "@/components/ui/card";

export function About() {
  return (
    <Card>
      <CardContent className="space-y-8 py-2 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">The idea</h2>
          <p className="text-muted-foreground">
            Pitchwork is a RAG (retrieval-augmented generation) system over a corpus
            of music criticism: reviews and interviews. Ask a question, get
            back an answer that quotes passages from the corpus and cites them.
          </p>
          <p className="text-muted-foreground">
            RAG fixes two problems with asking an LLM directly. Models are trained
            on a fixed dataset, so they don't know anything past the cutoff. And
            without a real source, they will still produce plausible sounding
            answers you can't verify. RAG injects relevant passages into the prompt
            at query time and asks the model to cite which one it used.
          </p>
          <p className="text-muted-foreground">
            The answer is only as good as the retrieval. The system scores every
            chunk against the question by similarity and keeps the top-k, meaning
            the k highest scoring (here, the 12 closest). If the right chunk isn't
            in there, the model guesses or refuses. The inspector on the right
            shows what was retrieved, so you can see every chunk and prompt the
            system used.
          </p>
          <p className="text-muted-foreground">
            The shape is general. Anywhere a team has a body of trusted text, the
            same pipeline works: ingest, chunk, embed, retrieve, ground. Customer
            support chatbots over product docs, legal Q&amp;A over contracts, HR
            portals over the employee handbook, developer docs you can ask instead
            of grep, sales enablement over playbooks.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">Architecture</h2>
          <p className="text-muted-foreground">
            Three layers, all running inside the Next.js app.
          </p>
          <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground marker:text-muted-foreground/60">
            <li>
              <span className="text-foreground">Storage.</span> Postgres on Supabase
              with the <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pgvector</code>{" "}
              extension. Three tables:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">documents</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">chunks</code>{" "}
              (with a{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">vector(1536)</code>{" "}
              column), and{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ingest_jobs</code>.
              A <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">match_chunks</code>{" "}
              SQL function uses pgvector's{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">&lt;=&gt;</code>{" "}
              operator for cosine similarity. An{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ivfflat</code>{" "}
              index on the embedding column makes the search fast at the cost of
              being approximate. It builds clusters in vector space when the index is
              created and probes only the nearest few per query. Running retrieval
              inside Postgres avoids needing a separate vector database that has to
              stay in sync with the relational metadata.
            </li>
            <li>
              <span className="text-foreground">App.</span> Next.js 16 App Router.
              Every Supabase call uses the service-role key on the server. The
              browser never holds a database token, so we don't need RLS policies to
              keep the corpus private. Route handlers run the ingest pipeline today
              and the embed + retrieve + synthesise pipeline in stage 3. Long-running
              ingest work fires from the upload handler through{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">after()</code>,
              which lets the HTTP response return before the worker finishes. The UI
              is shadcn/ui on Base UI primitives with Tailwind v4 for layout.
            </li>
            <li>
              <span className="text-foreground">Models.</span> OpenAI{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">text-embedding-3-small</code>{" "}
              for embeddings at 1536 dims. The 3072-dim{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">text-embedding-3-large</code>{" "}
              variant gives a small recall improvement but doubles storage and query
              cost, which isn't worth it at this corpus size. Anthropic{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">claude-sonnet-4-6</code>{" "}
              handles metadata extraction through forced tool use, which guarantees
              a parseable JSON object with the expected keys, and later handles
              answer synthesis. Synthesis responses stream over Server-Sent Events.
              SSE rather than WebSockets because the traffic is one-way, server to
              client.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">Pipeline</h2>
          <ol className="ml-5 list-decimal space-y-2 text-muted-foreground marker:text-muted-foreground/60">
            <li>
              <span className="text-foreground">Ingest.</span> Drop a PDF and a
              five-stage worker runs server-side.{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">unpdf</code>,
              a serverless build of PDF.js, extracts the text. Image-only scans
              produce no text and the stage fails (TODO add OCR). One Claude call
              then extracts bibliographic metadata using a forced tool schema, which
              returns a JSON object with the expected keys instead of asking the
              model to emit JSON in free-form text. Chunking uses{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">js-tiktoken</code>{" "}
              with the{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">cl100k_base</code>{" "}
              encoding. 800-token windows match the input size{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">text-embedding-3-small</code>{" "}
              was trained on, large enough for each passage to carry topical context
              but small enough that the vector represents one idea. The 100-token
              overlap keeps an idea that straddles a chunk boundary from being split
              between two vectors with nothing shared. Embedding goes through the
              OpenAI batch endpoint, 32 chunks per request. Progress writes to{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ingest_jobs.progress</code>{" "}
              after every stage transition. The UI subscribes over SSE.
            </li>
            <li>
              <span className="text-foreground">Retrieve.</span> Embed the question
              with the same model used for the chunks. Both sides must live in the
              same vector space for the geometry to mean anything.{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">match_chunks</code>{" "}
              runs with optional artist or year filters. Internally it computes{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">1 - (chunk &lt;=&gt; query)</code>{" "}
              for each row and returns the top-k. Cosine distance subtracted from 1
              produces a 0-to-1 similarity score: 1 is the same direction in vector
              space, 0 is orthogonal. The{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ivfflat</code>{" "}
              index keeps queries fast at the cost of a small recall drop. An exact
              nearest-neighbour scan would be O(n) per query.
            </li>
            <li>
              <span className="text-foreground">Synthesise.</span> Top-k chunks and
              the question go to Claude in a prompt that labels each chunk with its
              ID and tells the model to cite by ID. The answer streams back token by
              token over SSE, so first paint happens in under a second even when the
              full response runs to ten. Citation IDs in the stream let the UI
              render inline source markers as the text arrives.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-medium text-foreground">The four tabs</h2>
          <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground marker:text-muted-foreground/60">
            <li><span className="text-foreground">Ask.</span> The chat surface.</li>
            <li><span className="text-foreground">Library.</span> What's in the corpus, down to individual chunks.</li>
            <li><span className="text-foreground">Ingest.</span> Drop in new sources, watch them chunk and embed.</li>
            <li><span className="text-foreground">Evals.</span> Retrieval recall and answer quality against a held-out question set.</li>
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
