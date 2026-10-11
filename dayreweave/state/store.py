from __future__ import annotations

import json
import sqlite3
from abc import ABC, abstractmethod
from pathlib import Path

from dayreweave.state.models import HistoryEntry, SessionState


class StateStore(ABC):
    @abstractmethod
    def save_session(self, state: SessionState) -> None: ...

    @abstractmethod
    def load_session(self, session_id: str) -> SessionState | None: ...

    @abstractmethod
    def list_sessions(self, user_id: str) -> list[str]: ...

    @abstractmethod
    def append_history(self, entry: HistoryEntry) -> None: ...

    @abstractmethod
    def get_history(self, session_id: str) -> list[HistoryEntry]: ...


class SQLiteStore(StateStore):
    def __init__(self, db_path: str | Path = "dayreweave.db") -> None:
        self._db_path = str(db_path)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_schema(self) -> None:
        conn = self._connect()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_user
                    ON sessions(user_id);

                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    step_id TEXT,
                    timestamp TEXT NOT NULL,
                    state_before TEXT NOT NULL,
                    state_after TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
                );

                CREATE INDEX IF NOT EXISTS idx_history_session
                    ON history(session_id);
            """)
            conn.commit()
        finally:
            conn.close()

    def save_session(self, state: SessionState) -> None:
        conn = self._connect()
        try:
            state_json = state.model_dump_json()
            conn.execute(
                """
                INSERT INTO sessions (session_id, user_id, state_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    state_json = excluded.state_json,
                    updated_at = excluded.updated_at
                """,
                (state.session_id, state.user_id, state_json, state.created_at, state.created_at),
            )
            conn.commit()
        finally:
            conn.close()

    def load_session(self, session_id: str) -> SessionState | None:
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT state_json FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if row is None:
                return None
            return SessionState.model_validate_json(row[0])
        finally:
            conn.close()

    def list_sessions(self, user_id: str) -> list[str]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT session_id FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [r[0] for r in rows]
        finally:
            conn.close()

    def append_history(self, entry: HistoryEntry) -> None:
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO history (session_id, action, step_id, timestamp, state_before, state_after)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (entry.session_id, entry.action, entry.step_id, entry.timestamp, entry.state_before, entry.state_after),
            )
            conn.commit()
        finally:
            conn.close()

    def get_history(self, session_id: str) -> list[HistoryEntry]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT session_id, action, step_id, timestamp, state_before, state_after FROM history WHERE session_id = ? ORDER BY id ASC",
                (session_id,),
            ).fetchall()
            return [
                HistoryEntry(
                    session_id=r[0], action=r[1], step_id=r[2],
                    timestamp=r[3], state_before=r[4], state_after=r[5],
                )
                for r in rows
            ]
        finally:
            conn.close()
