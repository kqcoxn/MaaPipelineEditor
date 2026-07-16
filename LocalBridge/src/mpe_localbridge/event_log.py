from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from pathlib import Path
from threading import RLock

from .models import DebugEvent
from .paths import cache_dir


class EventLog:
    """Append-only debug event storage backed by SQLite WAL."""

    def __init__(self, path: Path | None = None) -> None:
        default_path = cache_dir() / "debug-events.sqlite3"
        self.path = path or default_path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA synchronous=NORMAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS debug_events (
                session_id TEXT NOT NULL,
                seq INTEGER NOT NULL,
                run_id TEXT,
                timestamp TEXT NOT NULL,
                body TEXT NOT NULL,
                PRIMARY KEY (session_id, seq)
            )
            """
        )
        self._connection.execute(
            "CREATE INDEX IF NOT EXISTS debug_events_run ON debug_events(session_id, run_id, seq)"
        )
        self._connection.commit()
        self._lock = RLock()

    def append(self, event: DebugEvent) -> DebugEvent:
        with self._lock:
            next_seq = self._connection.execute(
                "SELECT COALESCE(MAX(seq), 0) + 1 FROM debug_events WHERE session_id = ?",
                (event.session_id,),
            ).fetchone()[0]
            stored = event.model_copy(update={"seq": int(next_seq)})
            body = stored.model_dump_json(by_alias=True)
            self._connection.execute(
                """INSERT INTO debug_events(
                    session_id, seq, run_id, timestamp, body
                ) VALUES (?, ?, ?, ?, ?)""",
                (
                    stored.session_id,
                    stored.seq,
                    stored.run_id,
                    stored.timestamp.isoformat(),
                    body,
                ),
            )
            self._connection.commit()
        return stored

    def list(
        self,
        session_id: str,
        *,
        after_seq: int = 0,
        limit: int = 2_000,
        run_id: str | None = None,
    ) -> list[DebugEvent]:
        limit = max(1, min(limit, 10_000))
        query = "SELECT body FROM debug_events WHERE session_id = ? AND seq > ?"
        parameters: list[str | int] = [session_id, after_seq]
        if run_id is not None:
            query += " AND run_id = ?"
            parameters.append(run_id)
        query += " ORDER BY seq LIMIT ?"
        parameters.append(limit)
        with self._lock:
            rows = self._connection.execute(query, parameters).fetchall()
        return [DebugEvent.model_validate_json(row[0]) for row in rows]

    def iter_session_ids(self) -> Iterable[str]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT DISTINCT session_id FROM debug_events ORDER BY session_id"
            ).fetchall()
        return (str(row[0]) for row in rows)

    def delete_session(self, session_id: str) -> None:
        with self._lock:
            self._connection.execute(
                "DELETE FROM debug_events WHERE session_id = ?", (session_id,)
            )
            self._connection.commit()

    def export_json(self, session_id: str) -> bytes:
        events = self.list(session_id, limit=10_000)
        return json.dumps(
            [event.model_dump(mode="json", by_alias=True) for event in events],
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

    def close(self) -> None:
        with self._lock:
            self._connection.close()
