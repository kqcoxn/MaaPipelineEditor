from __future__ import annotations

from pathlib import Path

from mpe_localbridge.event_log import EventLog
from mpe_localbridge.models import DebugEvent


def test_event_log_is_append_only_and_resumable(tmp_path: Path) -> None:
    log = EventLog(tmp_path / "events.sqlite3")

    first = log.append(
        DebugEvent(
            session_id="session-1",
            run_id="run-1",
            source="maafw",
            kind="node",
            phase="starting",
            status="running",
        )
    )
    second = log.append(
        DebugEvent(
            session_id="session-1",
            run_id="run-1",
            source="maafw",
            kind="node",
            phase="succeeded",
            status="succeeded",
            parent_seq=first.seq,
        )
    )

    assert (first.seq, second.seq) == (1, 2)
    assert [event.seq for event in log.list("session-1", after_seq=1)] == [2]
    assert log.list("session-1")[0].phase == "starting"
    log.close()
