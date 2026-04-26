# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from api.chat import router as chat_router

settings = get_settings()

app = FastAPI(
    title="Mindful AI — FastAPI Backend",
    description="LangGraph-powered therapy agent with RAG memory",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "provider": settings.ai_provider,
        "environment": settings.environment,
    }