# app/main.py
import os
from dotenv import load_dotenv
load_dotenv()

if os.getenv("LANGCHAIN_API_KEY"):
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT", "mindful-ai")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from api.chat import router as chat_router
from api.voice import router as voice_router

settings = get_settings()

app = FastAPI(
    title="Mindful AI — FastAPI Backend",
    description="LangGraph-powered therapy agent with RAG memory and voice",
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
app.include_router(voice_router, prefix="/api")

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "provider": settings.ai_provider,
        "environment": settings.environment,
        "langsmith_enabled": bool(os.getenv("LANGCHAIN_API_KEY")),
        "voice_enabled": bool(settings.elevenlabs_api_key),
    }