from __future__ import annotations

import json
import os
from pathlib import Path

from mcp import types
from mcp.server import Server
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse
from starlette.routing import Route

from dayreweave.state.models import TaskInput
from dayreweave.state.session import Session, SessionError
from dayreweave.state.store import SQLiteStore

DB_PATH = os.environ.get("DAYREWEAVE_DB", "dayreweave.db")
store = SQLiteStore(DB_PATH)

SIMULATOR_DIR = Path(__file__).resolve().parent.parent / "simulator"

TOOLS = [
    types.Tool(
        name="create_plan",
        description="Create a morning routine plan with tasks, departure time, and essential tasks.",
        input_schema={
            "type": "object",
            "properties": {
                "departure_time": {"type": "string", "description": "When you need to leave, e.g. '08:30'"},
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "duration_min": {"type": "integer", "minimum": 1},
                        },
                        "required": ["id", "name", "duration_min"],
                    },
                    "description": "List of tasks with id, name, and estimated duration in minutes",
                },
                "essential_task_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "IDs of tasks that cannot be skipped",
                },
                "user_id": {"type": "string", "description": "User identifier"},
            },
            "required": ["departure_time", "tasks", "essential_task_ids", "user_id"],
        },
    ),
    types.Tool(
        name="get_current_step",
        description="Get the next step the user should do.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="complete_step",
        description="Mark a step as completed. Defaults to the current step if step_id is omitted.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
                "step_id": {"type": "string", "description": "Optional step ID; defaults to current step"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="skip_step",
        description="Skip a step. Defaults to the current step if step_id is omitted.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
                "step_id": {"type": "string", "description": "Optional step ID; defaults to current step"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="undo_last",
        description="Revert the last action on this routine.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="pause_routine",
        description="Pause the routine. Tracks how long the pause lasts.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="resume_routine",
        description="Resume a paused routine. Shows how long you were away.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="replan",
        description="Replan the routine with less time. Defers optional tasks to fit the deadline. Reports when essentials alone exceed available time.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
                "available_minutes": {"type": "integer", "minimum": 1, "description": "Minutes available from now"},
            },
            "required": ["session_id", "available_minutes"],
        },
    ),
    types.Tool(
        name="get_progress",
        description="Get a structured progress summary for the routine.",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
            },
            "required": ["session_id"],
        },
    ),
    types.Tool(
        name="restore_step",
        description="Restore a previously completed or skipped step back to pending. Use for corrections like 'Actually, I haven't done that yet.'",
        input_schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
                "step_id": {"type": "string", "description": "The step to restore to pending"},
            },
            "required": ["session_id", "step_id"],
        },
    ),
]


def _text_result(data: dict | str, is_error: bool = False) -> types.CallToolResult:
    text = data if isinstance(data, str) else json.dumps(data, indent=2)
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=text)],
        is_error=is_error,
    )


async def handle_list_tools(ctx, params) -> types.ListToolsResult:
    return types.ListToolsResult(tools=TOOLS)


async def handle_call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
    name = params.name
    args = params.arguments or {}

    try:
        if name == "create_plan":
            tasks = [TaskInput(**t) for t in args["tasks"]]
            session = Session.start(
                tasks=tasks,
                essential_task_ids=args["essential_task_ids"],
                user_id=args["user_id"],
                departure_time=args["departure_time"],
                store=store,
            )
            current = session.get_current_step()
            return _text_result({
                "session_id": session.session_id,
                "total_steps": len(tasks),
                "first_step": current.model_dump() if current else None,
                "message": f"Plan created. First up: {current.name}, {current.duration_min} min." if current else "Plan created (no steps).",
            })

        session = Session.resume(args["session_id"], store)

        if name == "get_current_step":
            step = session.get_current_step()
            if step is None:
                return _text_result({"message": "All steps done!", "step": None})
            return _text_result({
                "step": step.model_dump(),
                "message": f"Next: {step.name}, {step.duration_min} min.",
            })

        if name == "complete_step":
            step = session.complete_step(args.get("step_id"))
            nxt = session.get_current_step()
            msg = f"{step.name} done."
            if nxt:
                msg += f" Next: {nxt.name}, {nxt.duration_min} min."
            else:
                msg += " All steps complete!"
            return _text_result({"completed": step.model_dump(), "next": nxt.model_dump() if nxt else None, "message": msg})

        if name == "skip_step":
            step = session.skip_step(args.get("step_id"))
            nxt = session.get_current_step()
            msg = f"Skipped {step.name}."
            if nxt:
                msg += f" Next: {nxt.name}, {nxt.duration_min} min."
            return _text_result({"skipped": step.model_dump(), "next": nxt.model_dump() if nxt else None, "message": msg})

        if name == "undo_last":
            state = session.undo_last()
            current = session.get_current_step()
            return _text_result({"message": "Undone.", "current_step": current.model_dump() if current else None})

        if name == "pause_routine":
            state = session.pause_routine()
            return _text_result({"message": "Routine paused.", "status": state.status.value})

        if name == "resume_routine":
            result = session.resume_routine()
            return _text_result({
                "message": f"Resumed after {result['elapsed_minutes']} min.",
                "elapsed_minutes": result["elapsed_minutes"],
                "current_step": result["current_step"].model_dump() if result["current_step"] else None,
            })

        if name == "replan":
            result = session.replan(args["available_minutes"])
            if not result["feasible"]:
                return _text_result({"feasible": False, "message": result["reason"]})
            deferred_names = [d["name"] for d in result["deferred"]]
            msg = f"Replanned for {args['available_minutes']} min."
            if deferred_names:
                msg += f" Deferred: {', '.join(deferred_names)}."
            return _text_result({"feasible": True, "message": msg, **result})

        if name == "get_progress":
            return _text_result(session.get_progress())

        if name == "restore_step":
            step = session.restore_step(args["step_id"])
            return _text_result({
                "restored": step.model_dump(),
                "message": f"{step.name} restored to pending.",
            })

        return _text_result(f"Unknown tool: {name}", is_error=True)

    except SessionError as e:
        return _text_result(str(e), is_error=True)
    except Exception as e:
        return _text_result(f"Internal error: {e}", is_error=True)


async def simulator_page(request: Request):
    html_path = SIMULATOR_DIR / "index.html"
    if html_path.exists():
        return FileResponse(html_path, media_type="text/html")
    return HTMLResponse("<h1>Simulator not built yet</h1>", status_code=404)


def create_app() -> "Starlette":
    server = Server(
        "dayreweave",
        version="0.1.0",
        description="DayReweave — a morning-routine assistant",
        on_list_tools=handle_list_tools,
        on_call_tool=handle_call_tool,
    )

    app = server.streamable_http_app(
        streamable_http_path="/mcp",
        custom_starlette_routes=[
            Route("/", simulator_page),
            Route("/simulator", simulator_page),
        ],
    )

    return app


app = create_app()
