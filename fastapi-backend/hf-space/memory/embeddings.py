# app/memory/embeddings.py
import os
from dotenv import load_dotenv
from supabase import create_client
import google.generativeai as genai
from core.config import get_settings

load_dotenv()
settings = get_settings()

genai.configure(api_key=settings.gemini_api_key)

def get_supabase():
    return create_client(
        settings.next_public_supabase_url,
        settings.supabase_service_role_key,
    )

async def generate_embedding(text: str) -> list[float]:
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="retrieval_document",
    )
    return result["embedding"]

async def store_memory(
    user_id: str,
    session_id: str,
    content: str,
    memory_type: str = "session",
):
    try:
        embedding = await generate_embedding(content)
        supabase = get_supabase()
        supabase.table("memory_embeddings").insert({
            "user_id": user_id,
            "session_id": session_id,
            "content": content,
            "embedding": embedding,
            "memory_type": memory_type,
        }).execute()
        print(f"[memory] Stored: {content[:60]}...")
    except Exception as e:
        print(f"[memory] Failed to store: {e}")

async def store_session_memories(
    user_id: str,
    session_id: str,
    messages: list[dict],
):
    for msg in messages:
        if msg.get("role") == "user" and len(msg.get("content", "")) > 20:
            await store_memory(
                user_id=user_id,
                session_id=session_id,
                content=msg["content"],
                memory_type="session",
            )