---
title: Mindful AI API
emoji: 🧠
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# Mindful AI — FastAPI Backend

LangGraph-powered therapy agent with RAG memory.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill in the keys before starting.

## Endpoints

- `GET  /health` — service + provider status
- `POST /api/chat` — therapy chat turn (LangGraph pipeline)
- `POST /api/voice/transcribe` — speech → text
- `POST /api/voice/synthesize` — text → speech
