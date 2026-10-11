from __future__ import annotations

import uuid
from datetime import datetime

from dayreweave.state.models import (
    HistoryEntry,
    SessionState,
    SessionStatus,
    StepState,
    StepStatus,
    TaskInput,
)
from dayreweave.state.store import StateStore


class SessionError(Exception):
    pass


class Session:
    def __init__(self, state: SessionState, store: StateStore) -> None:
        self._state = state
        self._store = store

    @property
    def session_id(self) -> str:
        return self._state.session_id

    @classmethod
    def start(
        cls,
        tasks: list[TaskInput],
        essential_task_ids: list[str],
        user_id: str,
        departure_time: str,
        store: StateStore,
    ) -> Session:
        session_id = f"ses_{uuid.uuid4().hex[:12]}"
        steps = [
            StepState(
                id=t.id,
                name=t.name,
                duration_min=t.duration_min,
                essential=t.id in essential_task_ids,
            )
            for t in tasks
        ]
        state = SessionState(
            session_id=session_id,
            user_id=user_id,
            departure_time=departure_time,
            steps=steps,
        )
        store.save_session(state)
        return cls(state, store)

    @classmethod
    def resume(cls, session_id: str, store: StateStore) -> Session:
        state = store.load_session(session_id)
        if state is None:
            raise SessionError(f"Session {session_id} not found")
        return cls(state, store)

    def state(self) -> SessionState:
        return self._state.model_copy()

    def history(self) -> list[HistoryEntry]:
        return self._store.get_history(self._state.session_id)

    def _save_with_history(self, action: str, step_id: str | None, old_state: SessionState) -> None:
        entry = HistoryEntry(
            session_id=self._state.session_id,
            action=action,
            step_id=step_id,
            state_before=old_state.model_dump_json(),
            state_after=self._state.model_dump_json(),
        )
        self._store.append_history(entry)
        self._store.save_session(self._state)

    def _require_active(self) -> None:
        if self._state.status == SessionStatus.PAUSED:
            raise SessionError("Session is paused. Call resume_routine first.")
        if self._state.status == SessionStatus.COMPLETED:
            raise SessionError("Session is already completed.")

    def _find_step(self, step_id: str) -> StepState:
        for s in self._state.steps:
            if s.id == step_id:
                return s
        raise SessionError(f"Step {step_id!r} not found")

    def get_current_step(self) -> StepState | None:
        self._require_active()
        for s in self._state.steps:
            if s.status == StepStatus.PENDING:
                return s
        return None

    def complete_step(self, step_id: str | None = None) -> StepState:
        self._require_active()
        old = self._state.model_copy(deep=True)

        if step_id is None:
            step = self.get_current_step()
            if step is None:
                raise SessionError("No pending steps to complete")
        else:
            step = self._find_step(step_id)

        if step.status == StepStatus.COMPLETED:
            return step

        step.status = StepStatus.COMPLETED
        self._check_completion()
        self._save_with_history("complete", step.id, old)
        return step

    def skip_step(self, step_id: str | None = None) -> StepState:
        self._require_active()
        old = self._state.model_copy(deep=True)

        if step_id is None:
            step = self.get_current_step()
            if step is None:
                raise SessionError("No pending steps to skip")
        else:
            step = self._find_step(step_id)

        if step.status == StepStatus.SKIPPED:
            return step

        step.status = StepStatus.SKIPPED
        self._check_completion()
        self._save_with_history("skip", step.id, old)
        return step

    def block_step(self, step_id: str | None = None) -> StepState:
        self._require_active()
        old = self._state.model_copy(deep=True)

        if step_id is None:
            step = self.get_current_step()
            if step is None:
                raise SessionError("No pending steps to block")
        else:
            step = self._find_step(step_id)

        if step.status == StepStatus.BLOCKED:
            return step

        step.status = StepStatus.BLOCKED
        self._check_completion()
        self._save_with_history("block", step.id, old)
        return step

    def undo_last(self) -> SessionState:
        history = self._store.get_history(self._state.session_id)
        if not history:
            raise SessionError("Nothing to undo")

        last = history[-1]
        if last.action == "create":
            raise SessionError("Cannot undo session creation")

        old = self._state.model_copy(deep=True)
        restored = SessionState.model_validate_json(last.state_before)
        self._state = restored
        self._save_with_history("undo", None, old)
        return self._state.model_copy()

    def pause_routine(self) -> SessionState:
        self._require_active()
        old = self._state.model_copy(deep=True)
        self._state.status = SessionStatus.PAUSED
        self._state.paused_at = datetime.utcnow().isoformat()
        self._save_with_history("pause", None, old)
        return self._state.model_copy()

    def resume_routine(self) -> dict:
        if self._state.status != SessionStatus.PAUSED:
            raise SessionError("Session is not paused")
        old = self._state.model_copy(deep=True)

        paused_at = datetime.fromisoformat(self._state.paused_at)
        now = datetime.utcnow()
        elapsed = now - paused_at

        self._state.status = SessionStatus.ACTIVE
        self._state.paused_at = None
        self._save_with_history("resume", None, old)

        return {
            "status": "resumed",
            "elapsed_minutes": round(elapsed.total_seconds() / 60, 1),
            "current_step": self.get_current_step(),
        }

    def replan(self, available_minutes: int) -> dict:
        self._require_active()
        old = self._state.model_copy(deep=True)

        essential_pending = [
            s for s in self._state.steps
            if s.essential and s.status == StepStatus.PENDING
        ]
        optional_pending = [
            s for s in self._state.steps
            if not s.essential and s.status == StepStatus.PENDING
        ]

        essential_time = sum(s.duration_min for s in essential_pending)
        if essential_time > available_minutes:
            return {
                "feasible": False,
                "reason": f"Essential tasks need {essential_time} min but only {available_minutes} min available",
                "essential_pending": [s.model_dump() for s in essential_pending],
            }

        remaining = available_minutes - essential_time
        kept_optional = []
        deferred = []

        for s in optional_pending:
            if remaining >= s.duration_min:
                kept_optional.append(s)
                remaining -= s.duration_min
            else:
                s.status = StepStatus.SKIPPED
                deferred.append(s)

        self._check_completion()
        self._save_with_history("replan", None, old)

        return {
            "feasible": True,
            "available_minutes": available_minutes,
            "essential_kept": [s.model_dump() for s in essential_pending],
            "optional_kept": [s.model_dump() for s in kept_optional],
            "deferred": [s.model_dump() for s in deferred],
        }

    def get_progress(self) -> dict:
        steps = self._state.steps
        completed = [s for s in steps if s.status == StepStatus.COMPLETED]
        skipped = [s for s in steps if s.status == StepStatus.SKIPPED]
        pending = [s for s in steps if s.status == StepStatus.PENDING]
        blocked = [s for s in steps if s.status == StepStatus.BLOCKED]

        essentials_pending = [s for s in pending if s.essential]
        total_remaining_min = sum(s.duration_min for s in pending)
        current = self.get_current_step() if self._state.status == SessionStatus.ACTIVE else None

        return {
            "session_id": self._state.session_id,
            "status": self._state.status.value,
            "departure_time": self._state.departure_time,
            "total_steps": len(steps),
            "completed": len(completed),
            "skipped": len(skipped),
            "pending": len(pending),
            "blocked": len(blocked),
            "essentials_pending": len(essentials_pending),
            "remaining_minutes": total_remaining_min,
            "current_step": current.model_dump() if current else None,
            "steps": [s.model_dump() for s in steps],
        }

    def restore_step(self, step_id: str) -> StepState:
        """Restore a completed/skipped/blocked step back to pending (correction)."""
        self._require_active()
        old = self._state.model_copy(deep=True)
        step = self._find_step(step_id)
        if step.status == StepStatus.PENDING:
            return step
        step.status = StepStatus.PENDING
        if self._state.status == SessionStatus.COMPLETED:
            self._state.status = SessionStatus.ACTIVE
        self._save_with_history("restore", step.id, old)
        return step

    def _check_completion(self) -> None:
        if all(s.status != StepStatus.PENDING for s in self._state.steps):
            self._state.status = SessionStatus.COMPLETED
