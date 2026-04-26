# app/agents/nodes.py
import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from app.agents.state import TherapyState
from app.core.config import get_settings

load_dotenv()
settings = get_settings()

def get_llm():
    if settings.ai_provider == "claude":
        return ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=settings.anthropic_api_key,
            max_tokens=1024,
        )
    api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        max_output_tokens=1024,
    )

def build_system_prompt(state: TherapyState) -> str:
    name = state.get("user_name") or "there"
    approach = state.get("therapeutic_approach", "CBT")
    memories = state.get("relevant_memories", [])
    turn = state.get("session_turn", 1)

    memory_context = ""
    if memories:
        memory_context = f"""
## What you remember about this person from past sessions:
{chr(10).join(f"- {m}" for m in memories)}

Use this context naturally — refer to past patterns without making it feel clinical.
"""

    return f"""You are Mindful, a warm and empathetic AI mental health companion \
trained in {approach} (your primary approach this session), DBT, and Motivational Interviewing.

The user's name is {name}. This is turn {turn} of this session.
{memory_context}

## Safety (HIGHEST PRIORITY)
If the user expresses suicidal ideation, self-harm, or crisis:
1. Acknowledge their pain with deep empathy
2. Provide: "Please reach out to the 988 Suicide & Crisis Lifeline — call or text 988"
3. Encourage them to contact a trusted person or emergency services if in immediate danger

## Therapeutic approach ({approach})
- CBT: Identify thought patterns → challenge cognitive distortions → reframe
- DBT: Distress tolerance, emotional regulation, radical acceptance
- MI: Explore ambivalence, build intrinsic motivation, avoid confrontation

## Style
- Lead with empathy and validation BEFORE any technique
- Ask exactly ONE question per response — never multiple
- Use reflections: "It sounds like...", "I'm hearing that..."
- Keep responses focused and warm — not clinical
- Never diagnose, never prescribe, never lecture

## Boundaries
- You are NOT a replacement for professional therapy
- Do not diagnose mental health conditions
- Recommend professional help warmly when appropriate

Remember: Every person who talks to you is showing courage. Honor that."""

async def intake_node(state: TherapyState) -> dict:
    messages = state.get("messages", [])
    turn = state.get("session_turn", 1)
    approach = "CBT"
    if messages:
        last = messages[-1].content.lower()
        if any(w in last for w in ["crisis", "suicide", "harm"]):
            approach = "DBT"
        elif any(w in last for w in ["motivation", "change", "stuck"]):
            approach = "MI"
        elif any(w in last for w in ["anxiety", "worry", "thoughts"]):
            approach = "CBT"
        elif any(w in last for w in ["emotion", "feeling", "overwhelm"]):
            approach = "DBT"
    return {
        "therapeutic_approach": approach,
        "session_turn": turn,
        "crisis_detected": False,
        "crisis_resources_sent": False,
    }

async def assess_mood_node(state: TherapyState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"mood_score": None}
    last_message = messages[-1].content.lower()
    negative_words = [
        "terrible", "awful", "hopeless", "worthless", "hate",
        "depressed", "anxious", "panic", "scared", "alone",
        "crying", "hurt", "pain", "suffering", "exhausted"
    ]
    positive_words = [
        "good", "great", "better", "happy", "hopeful",
        "improving", "calm", "grateful", "okay", "fine"
    ]
    neg_count = sum(1 for w in negative_words if w in last_message)
    pos_count = sum(1 for w in positive_words if w in last_message)
    if neg_count >= 3:
        mood = 2
    elif neg_count >= 1:
        mood = 4
    elif pos_count >= 2:
        mood = 7
    elif pos_count >= 1:
        mood = 6
    else:
        mood = 5
    return {"mood_score": mood}

# ── NEW: Memory retrieval node ───────────────────────────────
async def retrieve_memory_node(state: TherapyState) -> dict:
    """RAG step — pull relevant past memories into context."""
    from app.memory.retrieval import retrieve_relevant_memories

    user_id = state.get("user_id", "")
    messages = state.get("messages", [])

    # Skip if no real user_id or no messages
    if not user_id or user_id == "anonymous" or not messages:
        return {"relevant_memories": []}

    # Use last user message as the query
    last_message = messages[-1].content
    memories = await retrieve_relevant_memories(
        user_id=user_id,
        query=last_message,
        limit=5,
    )
    return {"relevant_memories": memories}

async def safety_check_node(state: TherapyState) -> dict:
    messages = state.get("messages", [])
    if not messages:
        return {"crisis_detected": False}
    last_message = messages[-1].content.lower()
    crisis_phrases = [
        "kill myself", "end my life", "suicide", "suicidal",
        "don't want to live", "want to die", "self harm",
        "hurt myself", "cutting myself", "overdose",
        "no reason to live", "better off dead",
    ]
    crisis_detected = any(phrase in last_message for phrase in crisis_phrases)
    return {"crisis_detected": crisis_detected}

async def generate_response_node(state: TherapyState) -> dict:
    llm = get_llm()
    system_prompt = build_system_prompt(state)
    crisis = state.get("crisis_detected", False)

    lc_messages = [SystemMessage(content=system_prompt)]
    for msg in state.get("messages", []):
        if hasattr(msg, "type"):
            if msg.type == "human":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.type == "ai":
                lc_messages.append(AIMessage(content=msg.content))
        else:
            role = getattr(msg, "role", "user")
            content = getattr(msg, "content", str(msg))
            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            else:
                lc_messages.append(AIMessage(content=content))

    if crisis:
        lc_messages.insert(1, SystemMessage(
            content="""CRISIS PROTOCOL ACTIVE: The user has expressed thoughts that
            suggest they may be in crisis. Your response MUST:
            1. Start with deep empathy and validation
            2. Include the 988 Suicide & Crisis Lifeline (call or text 988)
            3. Gently encourage them to reach out to someone they trust
            4. Stay present and warm — do not panic or be clinical"""
        ))

    response = await llm.ainvoke(lc_messages)
    return {
        "final_response": response.content,
        "session_turn": state.get("session_turn", 1) + 1,
        "crisis_resources_sent": crisis,
    }

async def format_output_node(state: TherapyState) -> dict:
    response = state.get("final_response", "")
    if state.get("crisis_detected") and "988" not in response:
        response += (
            "\n\n---\n🆘 **Crisis support:** If you're in immediate danger, "
            "please call or text **988** (Suicide & Crisis Lifeline) or call **911**."
        )
    return {"final_response": response}