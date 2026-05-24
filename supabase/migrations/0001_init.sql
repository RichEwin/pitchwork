create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  album text,
  year int,
  source_type text,
  source_url text,
  storage_path text,
  raw_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_artist_idx on documents (artist);
create index if not exists documents_year_idx on documents (year);
create index if not exists documents_artist_year_idx on documents (artist, year);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chunks_document_id_idx on chunks (document_id);

create index if not exists chunks_embedding_ivfflat
  on chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete set null,
  status text not null default 'pending',
  error text,
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ingest_jobs_status_idx on ingest_jobs (status);

create or replace function match_chunks (
  query_embedding vector(1536),
  match_threshold float default 0.0,
  match_count int default 12,
  filter_artist text default null,
  filter_year int default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  document_artist text,
  document_year int,
  document_metadata jsonb,
  chunk_metadata jsonb
)
language sql stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title as document_title,
    d.artist as document_artist,
    d.year as document_year,
    d.metadata as document_metadata,
    c.metadata as chunk_metadata
  from chunks c
  join documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_artist is null or d.artist = filter_artist)
    and (filter_year is null or d.year = filter_year)
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
