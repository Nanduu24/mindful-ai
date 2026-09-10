-- Mindful AI — Supabase schema for RAG memory
-- Run this in the Supabase SQL editor on a fresh project.
--
-- Embeddings come from Gemini `models/gemini-embedding-001` (3072 dimensions).
-- pgvector ANN indexes (ivfflat/hnsw) cap at 2000 dims, so this table has no
-- ANN index — cosine search runs as a sequential scan, which is fine for the
-- per-user memory sizes this app produces. If the table grows large, reduce
-- the embedding dimensionality (Gemini supports output_dimensionality) and add
-- an hnsw index.

create extension if not exists vector;

create table if not exists memory_embeddings (
    id          uuid primary key default gen_random_uuid(),
    user_id     text        not null,
    session_id  text        not null default 'default',
    content     text        not null,
    embedding   vector(3072) not null,
    memory_type text        not null default 'session',
    created_at  timestamptz not null default now()
);

create index if not exists memory_embeddings_user_id_idx
    on memory_embeddings (user_id);

-- Cosine-similarity search used by app/memory/retrieval.py
create or replace function match_memories(
    query_embedding vector(3072),
    match_user_id   text,
    match_threshold float,
    match_count     int
)
returns table (
    id         uuid,
    content    text,
    similarity float
)
language sql stable
as $$
    select
        m.id,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity
    from memory_embeddings m
    where m.user_id = match_user_id
      and 1 - (m.embedding <=> query_embedding) > match_threshold
    order by m.embedding <=> query_embedding
    limit match_count;
$$;
