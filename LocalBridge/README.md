# MaaPipelineEditor LocalBridge

LocalBridge 是 MaaPipelineEditor 的唯一业务后端，基于 Python、FastAPI 与官方
`MaaFw` Python Binding。Editor 通过协议 `2.0.0` 的 `/v2/ws` 接口连接；图片和
调试产物通过 artifact HTTP 接口传输。

## 环境

- CPython 3.11-3.14
- MaaFw 5.12.1
- 推荐使用 [uv](https://docs.astral.sh/uv/) 管理开发环境

## 开发

```bash
uv sync --all-groups
uv run ruff check src tests
uv run pyright
uv run pytest
```

从仓库根目录运行 `yarn server` 时，工作区固定为 `LocalBridge`，Editor 地址固定为
`http://127.0.0.1:3000/development/`。命令行的 `--root`、`--port` 等覆盖只对当前
进程生效，不会写回用户配置。

生成协议 JSON Schema 与 Editor TypeScript 类型：

```bash
uv run python -m mpe_localbridge.schema \
  --schema schema/protocol-v2.schema.json \
  --typescript ../Editor/src/services/generated/bridge-v2.ts
```

## CLI

```bash
mpelb serve --root /path/to/workspace
mpelb doctor --json
mpelb version
```

`serve` 默认只绑定 `127.0.0.1`。独立运行时端口通过 Editor URL fragment 交付，
Desktop 模式则通过受限 stdio 控制通道交付。

`INFO` 只保留连接和控制器等用户可读信息；HTTP access、RPC、扫描耗时及框架运行
日志归入 `DEBUG`。

## 测试

```bash
uv run pytest
```

需要真实 MaaFw native runtime 的测试使用 `integration` marker，并在 Windows x64、
macOS arm64 与 Linux x64 发布矩阵中执行。
