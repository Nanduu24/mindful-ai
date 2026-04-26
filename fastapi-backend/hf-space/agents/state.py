# app/agents/state.py
from typing import TypedDict, Annotated, List, Optional
from langgraph.graph.message import add_messages

class TherapyState(TypedDict):
    # Core conversation
    messages: Annotated[list, add_messages]
    
    # User context
    user_id: str
    session_id: str
    user_name: Optional[str]
    
    # Session tracking
    mood_score: Optional[int]        # 1-10 scale
    session_turn: int                # which turn we're on
    therapeutic_approach: str        # CBT, DBT, MI
    
    # Memory
    relevant_memories: List[str]     # retrieved from pgvector
    
    # Safety
    crisis_detected: bool
    crisis_resources_sent: bool
    
    # Response
    final_response: str