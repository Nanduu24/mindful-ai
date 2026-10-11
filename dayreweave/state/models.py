from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel, Field


class StepStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    BLOCKED = "blocked"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class TaskInput(BaseModel):
    id: str
    name: str
    duration_min: int = Field(gt=0)


class StepState(BaseModel):
    id: str
    name: str
    duration_min: int
    essential: bool
    status: StepStatus = StepStatus.PENDING


class SessionState(BaseModel):
    session_id: str
    user_id: str
    departure_time: str
    steps: list[StepState]
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    paused_at: str | None = None


class HistoryEntry(BaseModel):
    session_id: str
    action: str
    step_id: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    state_before: str
    state_after: str
