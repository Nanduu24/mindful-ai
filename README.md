# 🧠 Mindful AI

An AI therapy companion that holds a natural, supportive conversation, adapts its
therapeutic approach to how you're feeling, remembers past sessions, and can talk
back out loud.

Full-stack: a **Next.js 16** app talking to a **FastAPI + LangGraph** agent backend.

> ⚠️ **Not a medical device.** Mindful AI is a portfolio project for wellbeing-style
> conversation, not a substitute for professional care. It is not for use in a crisis.

---

## Features

- **LangGraph therapy agent** — each turn runs through a 6-stage pipeline:
  `intake → assess mood → retrieve memory → safety check → generate response → format`.
- **RAG memory** — past messages are embedded (Gemini) and stored in Supabase
  `pgvector`; relevant memories are retrieved and fed back into the prompt so the
  agent recalls earlier context.
- **Adaptive approach** — picks a therapeutic style (CBT / DBT / …) and a mood score
  per turn.
- **Crisis safety check** — flags high-risk language before generating a response.
- **Voice mode** — speech-to-text and text-to-speech (ElevenLabs).
- **Multi-provider LLM** — swap between Groq, Gemini, and Claude via one env var.
- **Auth, billing, dashboard** — Clerk auth, Stripe pricing, and a mood/history
  dashboard (Recharts).
- **Observability** — LangSmith tracing when enabled.

## Architecture

```
Next.js 16 (App Router)                 FastAPI + LangGraph
┌───────────────────────────┐          ┌──────────────────────────────┐
│  Clerk auth · Stripe       │  HTTP    │  /api/chat   → therapy graph  │
│  chat · dashboard · history│ ───────▶ │  /api/voice  → STT / TTS      │
│  /api/* proxy routes       │          │  RAG: Supabase pgvector       │
└───────────────────────────┘          │  LLM: Groq / Gemini / Claude  │
        Vercel                          └──────────────────────────────┘
                                          HuggingFace Space (Docker)
```

The frontend proxies to the backend via the `FASTAPI_URL` env var.

## Tech stack

| Layer     | Tech |
|-----------|------|
| Frontend  | Next.js 16, React, Tailwind, Recharts, Zustand, React Query |
| Auth       | Clerk |
| Payments   | Stripe |
| Backend    | FastAPI, LangGraph, LangChain |
| LLM        | Groq (default), Gemini, Claude |
| Memory     | Supabase Postgres + pgvector, Gemini embeddings |
| Voice      | ElevenLabs |
| Tracing    | LangSmith |
| Deploy     | Vercel (web) · HuggingFace Space (API, Docker) |

## Getting started

### 1. Frontend

```bash
npm install
cp .env.example .env.local         # fill in keys (Clerk, Stripe, FASTAPI_URL, ...)
npm run dev                        # http://localhost:3000
```

### 2. Backend

```bash
cd fastapi-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # fill in keys (see below)
uvicorn app.main:app --reload --port 8000
```

### 3. Memory database (optional)

RAG memory needs Supabase. Create a project, then run
[`fastapi-backend/supabase_schema.sql`](fastapi-backend/supabase_schema.sql) in the
SQL editor and set `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Without
it the app still runs — memory simply no-ops.

## Configuration

Backend keys live in `fastapi-backend/.env` (see
[`.env.example`](fastapi-backend/.env.example)). Key ones:

- `AI_PROVIDER` — `groq` | `gemini` | `claude`
- `GROQ_API_KEY` / `GROQ_MODEL` (default `openai/gpt-oss-120b`)
- `GEMINI_API_KEY` — used for embeddings even when another provider generates replies
- `ELEVENLABS_API_KEY` — voice
- Supabase, Clerk, and LangSmith keys as needed

## API

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/health` | Service + provider status |
| `POST` | `/api/chat` | One therapy turn through the LangGraph pipeline |
| `POST` | `/api/voice/transcribe` | Speech → text |
| `POST` | `/api/voice/synthesize` | Text → speech |
