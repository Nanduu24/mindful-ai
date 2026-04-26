# app/memory/retrieval.py
from app.memory.embeddings import generate_embedding, get_supabase

async def retrieve_relevant_memories(
    user_id: str,
    query: str,
    limit: int = 5,
    similarity_threshold: float = 0.7,
) -> list[str]:
    """
    Retrieve semantically similar memories for a user.
    This is the RAG retrieval step — finds past context relevant to now.
    """
    try:
        query_embedding = await generate_embedding(query)
        supabase = get_supabase()

        # pgvector cosine similarity search
        result = supabase.rpc(
            "match_memories",
            {
                "query_embedding": query_embedding,
                "match_user_id": user_id,
                "match_threshold": similarity_threshold,
                "match_count": limit,
            },
        ).execute()

        memories = [row["content"] for row in (result.data or [])]
        print(f"[memory] Retrieved {len(memories)} memories for user {user_id[:8]}")
        return memories

    except Exception as e:
        print(f"[memory] Retrieval failed: {e}")
        return []