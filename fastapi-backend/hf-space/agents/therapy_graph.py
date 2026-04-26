# app/agents/therapy_graph.py
from langgraph.graph import StateGraph, END
from agents.state import TherapyState
from agents.nodes import (
    intake_node,
    assess_mood_node,
    safety_check_node,
    generate_response_node,
    format_output_node,
)

def build_therapy_graph():
    graph = StateGraph(TherapyState)

    # Add all nodes
    graph.add_node("intake", intake_node)
    graph.add_node("assess_mood", assess_mood_node)
    graph.add_node("safety_check", safety_check_node)
    graph.add_node("generate_response", generate_response_node)
    graph.add_node("format_output", format_output_node)

    # Entry point
    graph.set_entry_point("intake")

    # Linear flow
    graph.add_edge("intake", "assess_mood")
    graph.add_edge("assess_mood", "safety_check")
    graph.add_edge("safety_check", "generate_response")
    graph.add_edge("generate_response", "format_output")
    graph.add_edge("format_output", END)

    return graph.compile()

# Singleton — compiled once at startup
therapy_graph = build_therapy_graph()