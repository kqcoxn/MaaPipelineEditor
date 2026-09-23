# 安装与更新 LocalBridge 开发依赖

在仓库根目录运行以下命令，一次准备 MaaFramework、MaaAgentBinary 和 OCR（ppocr_v6-small）：

```bash
yarn lb:deps --dry-run
yarn lb:deps
```

不需要预先编译 LB，也不依赖 MPE 发布清单。动态库与 Agent 安装到 `LocalBridge/build/runtime/maafw`，OCR 安装到 `LocalBridge/build/runtime/resource/model/ocr`。OCR 使用与发布环境一致的 MaaCommonAssets 模型包，并检查 `det.onnx`、`rec.onnx`、`keys.txt` 均为非空文件。Go、Air 等开发工具需单独准备。

只更新 MaaFramework 与 MaaAgentBinary、保留现有 OCR 时，使用：

```bash
yarn update:mfw --dry-run
yarn update:mfw
```

两个命令需要 Node.js 20 或更高版本；macOS/Linux 需要 `unzip`，Windows 使用系统 PowerShell 的 `Expand-Archive`。命令默认从当前源码 `Editor/src/stores/app/configStore.ts` 读取 `mfwVersion`，下载 MaaXYZ/MaaFramework 对应 GitHub Release 的当前平台 x64/arm64 发行包。`yarn sync:references` 只更新参考源码，与运行依赖及 Go Binding 相互独立。

## 选择实际使用的目录

默认对应 `yarn server` 的 `LocalBridge/build/runtime`。LocalBridge 始终从可执行文件旁的 `runtime` 目录加载依赖。

Air 的 `clean_on_exit` 必须保持为 `false`，避免退出开发服务时删除 `build` 中的运行依赖。修改 `.air.toml` 后需完整退出并重新启动 Air；当前进程仍可能使用启动时读取的清理设置。手动删除 `LocalBridge/build` 后，需要重新运行 `yarn lb:deps`。

使用不同的构建位置时，指定可执行文件目录：

```bash
yarn lb:deps --binary-dir /path/to/lb --dry-run
yarn lb:deps --version 5.13.0 --dry-run
```

确认预览后移除 `--dry-run` 执行。`--version` 只覆盖本次 MaaFramework 下载版本，不修改源码中的版本要求。`yarn update:mfw` 支持相同参数。

## 更新与恢复

更新前停止使用这份运行时的 LocalBridge 和 Agent。命令下载并校验发行包，确认动态库、MaaAgentServer 和非空的 MaaAgentBinary 存在后，再替换 `bin`、`share/MaaAgentBinary` 和 `.version`。`yarn lb:deps` 还会下载并校验 OCR，再统一替换上述组件和 OCR 模型目录；下载或校验失败不会替换现有组件，任一组件替换失败都会尝试整体回滚。`yarn update:mfw` 保留 OCR。配置和其他资源保持原位。即使版本标记相同也会重新安装，便于修复缺失或混装的组件。

临时网络失败每个请求最多重试 2 次，分别等待 5 秒和 15 秒。可通过 `GITHUB_TOKEN` 提高 GitHub API 请求额度；令牌只用于 API 请求。认证、证书、文件权限等错误不会重试。

下载期间每 5 秒显示已下载大小、百分比（服务器提供总大小时）和平均速度。等待响应头或连续 30 秒没有收到数据会超时并按上述策略重试；慢速但持续传输不会因总时长被中断。按 Ctrl+C 取消下载后会清理临时文件并释放安装锁。正常状态日志使用英文，完整路径与下载地址可通过 `--dry-run` 查看。

更新成功后不保留旧版本备份。替换期间使用 `runtime`（完整安装）或 `runtime/maafw`（仅 MFW）中的 `.mpe-mfw-rollback-*` 临时保存旧组件，发生异常时自动尝试回滚；成功或回滚完成后会清理临时文件。若回滚未完成，会报告恢复文件的位置。不要混用不同版本的库和 Agent。

两个命令共用 `runtime/maafw/.mpe-mfw-update.lock` 防止重复执行。进程意外终止后，确认更新进程已退出并检查组件和临时回滚文件状态，再移除残留锁。

重启 LocalBridge 后检查日志中的实际库路径、MaaFramework 初始化结果，并手动验证设备连接及一次识别/调试操作。下载校验通过不能替代真实加载验证；初始化仍报缺失符号时，应核对实际加载路径、目标版本及平台架构。

维护脚本测试：`yarn lb:deps:test`（也可使用 `yarn update:mfw:test`）。测试只使用临时目录和构造的发行包，不更新本机运行时；macOS/Linux 测试额外需要 `zip`。
