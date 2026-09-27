# Issue #102：M9A Windows 调试记录

问题：<https://github.com/kqcoxn/MaaPipelineEditor/issues/102>

## 已核实的证据

- 崩溃堆栈位于 `PreparePIAgent → NewAgentClient → MaaAgentClientCreateV2`，尚未启动 M9A Agent 子进程，也未执行节点。
- 本地 M9A 参考提交为 `a95056aaa50cb2b2daed9d6ecd30353aeac3e223`（2026-09-21）。这不是反馈者声明的 v4.11.0；没有据此假定整个项目完全一致。
- 对照反馈者上传的 `mpe-logs-20260927-162228.zip`，`HomeFlagFirst`、`HomeFlag`、`RecordId`、`HomeFlagCloseReturnMain` 四个节点的数据与本地参考一致。
- 本机使用 MaaFramework 5.14.0 真实加载 M9A `resource/base` 成功，共 1140 个节点。`HomeFlagFirst` 为 TemplateMatch + Click，`RecordId` 为 TemplateMatch + Custom/RecordID。此检查未连接设备、未执行游戏操作。
- 本地 M9A 的 `interface.json` 配置 `uv run python agent/main.py`，没有固定 identifier。MPE 在参数末尾追加实际 identifier；M9A 的 `agent/agent_runtime.py` 直接将 `sys.argv[-1]` 传入 `AgentServer.start_up()`，不要求 UUID 格式。
- 本地 M9A 锁定 maafw 5.13.0；MPE 使用 5.14.0。两版 Agent 协议号均为 8，5.13.0 的 AgentServer 已支持数字端口 identifier。该差异本身不能解释发生在子进程启动之前的崩溃。

## 本次处理与验证范围

Windows 下自动创建的 PI Agent 使用 `127.0.0.1` 动态 TCP 端口，绕过 MaaFramework 的 `C:/Temp` 文件 socket 路径；项目明确配置的 identifier 按原语义处理。调试和 PI 任务运行共用创建入口。

修复了新客户端创建后资源加载失败时未释放 socket 的问题，并在 LB 日志中记录原生创建前后、框架实际版本与日志目录。

本机 macOS 已完成 MaaFramework 5.14.0 的真实 TCP 跨进程握手、客户端复用、失败后端口释放测试，以及 Windows amd64 编译。尚未运行 M9A 的完整 Python Agent：本机参考副本没有其虚拟环境，现有 Python 为 3.12，而其入口要求 Python 3.13。Windows 原始崩溃是否消失仍需现场验证。

## Windows 验证步骤

使用本次源码对应的 Editor 和 LocalBridge（协议均为 2.0.2）。不要只把测试 LB 替换到 2.0.1 Editor 中，以免协议校验干扰排查。

1. 在 M9A 项目根目录确认 `uv` 可用，并按项目要求准备 Python 3.13 与锁定依赖。确认 PI Agent 命令及工作目录指向该项目。
2. 选择 PI 配置、ADB 控制器和对应资源包，保持 Agent 启用，首次测试连接。LB 日志应出现 `创建 PI Agent 客户端: mode=tcp-auto`，随后出现 `PI Agent 客户端已创建` 与数字 identifier；M9A 应收到同一标识并输出 `AgentServer started.`。
3. 在游戏对应画面单节点运行 `HomeFlagFirst`，重复运行，并验证停止后重跑。重点确认 LB 和编辑器保持运行；识别未命中应作为普通调试结果呈现。
4. 在合适画面运行包含 `RecordId` 的流程，确认 Custom/RecordID 可用；再验证 PI 任务运行入口。单测 `HomeFlagFirst` 无法证明 Custom 回调链正常。
5. 关闭 Agent 后单独运行 `HomeFlagFirst` 做对照，再启用 Agent 重试。不要以禁用 Agent 验证整个启动流程，后续节点包含 Custom 动作。
6. 同时观察首次启动和后续重试，按下面的阶段区分故障。

## 按阶段判断

| 现象 | 下一步关注 |
| --- | --- |
| 只有“创建 PI Agent 客户端”，随后 LB 退出 | 原生创建仍失败，TCP 规避不足；保存此次 LB 崩溃堆栈和框架日志 |
| 已出现“PI Agent 客户端已创建”，但子进程启动失败 | `uv`、Python 版本、依赖、工作目录或 Agent 导入错误 |
| LB 存活，但提示连接超时 | 检查 Agent 是否仍在准备依赖、检查版本、热更新或注册 Custom |
| 已握手，Custom 动作执行失败 | 检查 M9A Python 异常与回调上下文，和原始创建阶段崩溃分开处理 |

M9A 在 `AgentServer.start_up()` **之前**依次检查版本、热更新资源、注册 Custom。版本检查的一次网络请求超时为 10 秒；MPE 的 PI 调试连接超时为 2 秒，PI 任务运行连接超时为 5 秒。因此冷启动存在连接超时风险；“测试连接”失败还会停止该 Agent，不能假定等待后它会自行就绪。本次没有把延长超时当成原始崩溃的修复。

现场建议保留三处日志：

- LB 日志中记录的 `logDir`（默认 `%APPDATA%\MaaPipelineEditor\LocalBridge\logs`）：MPE 宿主框架日志。
- M9A 项目下的 `debug/agent`：Python Agent 的框架日志。
- M9A 项目下的 `debug/custom`：M9A 自身日志，包含依赖版本、启动检查和 Python 异常。

M9A 的两个日志目录属于独立子进程，不能假定 MPE 的日志导出包已经包含它们。
