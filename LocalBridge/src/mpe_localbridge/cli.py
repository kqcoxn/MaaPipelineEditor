from __future__ import annotations

import argparse
import asyncio
import json
import logging
import socket
import sys
import threading
import webbrowser
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlencode, urlsplit, urlunsplit

import uvicorn

from .config import ConfigStore
from .constants import MAX_WS_MESSAGE_BYTES, PACKAGE_VERSION, PROTOCOL_VERSION
from .server import LocalBridgeState, create_app

DEFAULT_EDITOR_URL = "https://mpe.codax.site/stable/"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mpelb", description="MaaPipelineEditor LocalBridge")
    subparsers = parser.add_subparsers(dest="command")

    serve = subparsers.add_parser("serve", help="启动 LocalBridge")
    serve.add_argument("--host", default=None)
    serve.add_argument("--port", type=int, default=None)
    serve.add_argument("--root", default=None)
    serve.add_argument("--allow-origin", action="append", default=[])
    serve.add_argument("--config", type=Path, default=None)
    serve.add_argument("--editor-url", default=DEFAULT_EDITOR_URL, type=_editor_url)
    serve.add_argument("--control-stdio", action="store_true")
    serve.add_argument("--no-open", action="store_true")

    doctor = subparsers.add_parser("doctor", help="检查 Python 与 MaaFw 环境")
    doctor.add_argument("--json", action="store_true", dest="as_json")
    subparsers.add_parser("version", help="显示版本")

    config = subparsers.add_parser("config", help="查看或修改 LocalBridge 配置")
    config.add_argument("--config", type=Path, default=None)
    config_commands = config.add_subparsers(dest="config_command", required=True)
    config_commands.add_parser("path", help="显示配置文件路径")
    config_commands.add_parser("show", help="显示完整配置")
    get_config = config_commands.add_parser("get", help="读取点路径配置项")
    get_config.add_argument("key")
    set_config = config_commands.add_parser("set", help="设置点路径配置项")
    set_config.add_argument("key")
    set_config.add_argument("value", help="JSON 值, 无法解析为 JSON 时按字符串处理")
    return parser


def main(argv: list[str] | None = None) -> None:
    arguments = list(sys.argv[1:] if argv is None else argv)
    if not arguments:
        arguments = ["serve"]
    args = build_parser().parse_args(arguments)
    command = args.command
    if command == "version":
        print(PACKAGE_VERSION)
        return
    if command == "doctor":
        raise SystemExit(asyncio.run(_doctor(args.as_json)))
    if command == "config":
        raise SystemExit(_config_command(args))
    asyncio.run(_serve(args))


def _config_command(args: argparse.Namespace) -> int:
    store = ConfigStore(args.config)
    operation = cast(str, args.config_command)
    if operation == "path":
        print(store.path)
        return 0
    document = store.value.model_dump(mode="json")
    if operation == "show":
        print(json.dumps(document, ensure_ascii=False, indent=2))
        return 0

    key = cast(str, args.key)
    keys = _config_key_parts(key)
    if operation == "get":
        print(json.dumps(_config_value_at(document, keys), ensure_ascii=False, indent=2))
        return 0
    if operation == "set":
        update: dict[str, Any] = {}
        cursor = update
        for part in keys[:-1]:
            child: dict[str, Any] = {}
            cursor[part] = child
            cursor = child
        cursor[keys[-1]] = _parse_config_value(cast(str, args.value))
        value = store.update(update).model_dump(mode="json")
        print(json.dumps(_config_value_at(value, keys), ensure_ascii=False, indent=2))
        return 0
    raise ValueError(f"不支持的配置操作: {operation}")


def _config_key_parts(key: str) -> list[str]:
    parts = key.split(".")
    if not parts or any(not part for part in parts):
        raise ValueError(f"无效配置键: {key}")
    return parts


def _config_value_at(document: dict[str, Any], keys: list[str]) -> Any:
    value: Any = document
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            raise ValueError(f"配置键不存在: {'.'.join(keys)}")
        value = cast(dict[str, Any], value)[key]
    return value


def _parse_config_value(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


async def _doctor(as_json: bool) -> int:
    app, state = create_app()
    del app
    maa = await state.maa.probe()
    result = {
        "ok": bool(maa.get("available")),
        "packageVersion": PACKAGE_VERSION,
        "protocolVersion": PROTOCOL_VERSION,
        "pythonVersion": sys.version.split()[0],
        "maa": maa,
    }
    await state.close()
    if as_json:
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    else:
        print(f"LocalBridge {PACKAGE_VERSION}, protocol {PROTOCOL_VERSION}")
        print(f"Python: {result['pythonVersion']}")
        print(f"MaaFw: {maa.get('version') or maa.get('error')}")
    return 0 if result["ok"] else 1


async def _serve(args: argparse.Namespace) -> None:
    config_store = ConfigStore(args.config)
    updates: dict[str, Any] = {}
    server_updates: dict[str, Any] = {}
    if args.host is not None:
        server_updates["host"] = args.host
    if args.port is not None:
        server_updates["port"] = args.port
    if args.allow_origin:
        server_updates["allowed_origins"] = sorted(
            set(config_store.value.server.allowed_origins) | set(args.allow_origin)
        )
    if server_updates:
        updates["server"] = server_updates
    if args.root is not None:
        updates["file"] = {"root": args.root}
    if updates:
        config_store.update(updates)

    host = config_store.value.server.host
    if host not in {"127.0.0.1", "localhost"}:
        raise SystemExit("LocalBridge v2 只允许绑定 loopback 地址")
    app, state = create_app(config_store=config_store)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", config_store.value.server.port))
    sock.listen(2048)
    sock.setblocking(False)
    port = int(sock.getsockname()[1])

    logging.basicConfig(
        level=getattr(logging, config_store.value.log.level.upper(), logging.INFO),
        stream=sys.stderr,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    uvicorn_config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_config=None,
        ws_max_size=MAX_WS_MESSAGE_BYTES,
        timeout_graceful_shutdown=5,
    )
    server = uvicorn.Server(uvicorn_config)
    server_task = asyncio.create_task(server.serve(sockets=[sock]))
    while not server.started and not server_task.done():  # noqa: ASYNC110
        await asyncio.sleep(0.01)
    if server_task.done():
        await server_task
        return

    ready = {
        "type": "ready",
        "port": port,
        "protocolVersion": PROTOCOL_VERSION,
        "packageVersion": PACKAGE_VERSION,
    }
    if args.control_stdio:
        print(json.dumps(ready, ensure_ascii=False, separators=(",", ":")), flush=True)
        _start_control_reader(asyncio.get_running_loop(), server, state)
    else:
        print(f"LocalBridge 已启动: ws://127.0.0.1:{port}/v2/ws", file=sys.stderr)
        url = build_editor_url(cast(str, args.editor_url), port)
        print(f"Editor: {url}", file=sys.stderr)
        if not args.no_open:
            webbrowser.open(url)
    await server_task


def _editor_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError("Editor URL 必须是有效的 HTTP(S) 地址")
    return value


def build_editor_url(base_url: str, port: int) -> str:
    parsed = urlsplit(base_url)
    fragment = urlencode({"mpelb-port": port})
    return urlunsplit(parsed._replace(fragment=fragment))


def _start_control_reader(
    loop: asyncio.AbstractEventLoop,
    server: uvicorn.Server,
    state: LocalBridgeState,
) -> None:
    async def handle(message: dict[str, Any]) -> dict[str, Any]:
        command = message.get("command")
        if command == "health":
            return {"ok": True, "status": "ready"}
        if command == "stop_active_run":
            return {"ok": True, "stopped": await state.debug.stop_active()}
        if command == "shutdown":
            server.should_exit = True
            return {"ok": True}
        return {"ok": False, "error": "unsupported command"}

    def reader() -> None:
        for line in sys.stdin:
            try:
                message = json.loads(line)
                future = asyncio.run_coroutine_threadsafe(handle(message), loop)
                response = {"type": "control", "id": message.get("id"), **future.result(10)}
            except Exception as error:
                response = {"type": "control", "ok": False, "error": str(error)}
            print(json.dumps(response, ensure_ascii=False, separators=(",", ":")), flush=True)

    threading.Thread(target=reader, name="stdio-control", daemon=True).start()


if __name__ == "__main__":
    main()
