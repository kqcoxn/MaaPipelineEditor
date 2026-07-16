from __future__ import annotations

from mpe_localbridge.constants import EVENT_NAMES, PROTOCOL_VERSION, RPC_METHOD_NAMES
from mpe_localbridge.schema import protocol_schema, render_typescript


def test_schema_contains_protocol_contract() -> None:
    schema = protocol_schema()
    assert schema["x-protocol-version"] == PROTOCOL_VERSION
    assert schema["x-rpc-methods"] == list(RPC_METHOD_NAMES)
    assert schema["x-event-names"] == list(EVENT_NAMES)


def test_generated_types_include_every_method_and_event() -> None:
    typescript = render_typescript()
    assert all(f'"{method}"' in typescript for method in RPC_METHOD_NAMES)
    assert all(f'"{event}"' in typescript for event in EVENT_NAMES)
