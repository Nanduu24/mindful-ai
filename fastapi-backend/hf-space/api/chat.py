# app/api/chat.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
from langchain_core.messages import HumanMessage, AIMessage
from app.agents.therapy_graph import therapy_graph
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None

@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        # Convert messages to LangChain format
        lc_messages = []
        for msg in request.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            else:
                lc_messages.append(AIMessage(content=msg.content))

        # Build initial state
        initial_state: dict = {
            "messages": lc_messages,
            "user_id": request.user_id or "anonymous",
            "session_id": request.session_id or "default",
            "user_name": request.user_name,
            "session_turn": 1,
            "therapeutic_approach": "CBT",
            "relevant_memories": [],
            "crisis_detected": False,
            "crisis_resources_sent": False,
            "final_response": "",
            "mood_score": None,
        }

        # Run the graph
        result = await therapy_graph.ainvoke(initial_state)

        return {
            "response": result["final_response"],
            "mood_score": result.get("mood_score"),
            "therapeutic_approach": result.get("therapeutic_approach"),
            "crisis_detected": result.get("crisis_detected", False),
            "session_turn": result.get("session_turn", 1),
        }

    except Exception as e:
        print(f"[chat error] {e}")
        raise HTTPException(status_code=500, detail=str(e))