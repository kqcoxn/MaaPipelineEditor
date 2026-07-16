from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from mpe_localbridge.constants import PROTOCOL_VERSION
from mpe_localbridge.models import HelloParams, RpcRequest


def test_rpc_request_accepts_v2_envelope() -> None:
    request = RpcRequest.model_validate(
        {
            "v": 2,
            "type": "request",
            "id": "request-1",
            "method": "system.health",
            "params": {},
        }
    )

    assert request.method == "system.health"


@pytest.mark.parametrize("method", ["/etl/open_file", "System.Health", "health", ""])
def test_rpc_request_rejects_legacy_or_invalid_methods(method: str) -> None:
    with pytest.raises(ValidationError):
        RpcRequest.model_validate(
            {"v": 2, "type": "request", "id": "request-1", "method": method, "params": {}}
        )


def test_hello_uses_camel_case_contract() -> None:
    hello = HelloParams(
        protocol_version=PROTOCOL_VERSION,
        client_version="1.7.5",
    )

    encoded = json.loads(hello.model_dump_json(by_alias=True))

    assert "token" not in encoded
    assert encoded["protocolVersion"] == PROTOCOL_VERSION
    assert encoded["clientVersion"] == "1.7.5"
