# 更新本地 MaaFramework 开发依赖

参考仓库的源码、LocalBridge 使用的 Go Binding、运行时动态库是独立的依赖。`yarn sync:references` 只更新参考源码。开发时更新本机实际加载的动态库，使用：

```bash
yarn update:mfw --dry-run
yarn update:mfw
```

需要 Node.js 20 或更高版本；macOS/Linux 需要 `unzip`，Windows 使用系统 PowerShell 的 `Expand-Archive`。命令默认从当前源码 `Editor/src/stores/app/configStore.ts` 读取 `mfwVersion`，下载 MaaXYZ/MaaFramework 对应 GitHub Release 的当前平台 x64/arm64 发行包。

## 选择实际使用的目录

默认对应 `yarn server`：LocalBridge 启动目录为 `LocalBridge`，可执行文件目录为 `LocalBridge/build`。

- 可执行文件旁存在 `config` 目录时，优先读取其中的 `default.json`，否则读取 `config.json`。
- 没有该目录时，读取系统用户数据目录下 `MaaPipelineEditor/LocalBridge/config/config.json`，与 LocalBridge 默认路径规则一致。
- `maafw.lib_dir` 有效时优先使用；配置路径无效时尝试可执行文件旁的 `runtime/maafw/bin`。两者都不存在时使用非空的配置路径，否则创建附带运行时目录。
- 配置中的相对 `lib_dir` 按 LocalBridge 启动目录解析。命令参数中的相对路径按运行命令的当前目录解析。

先核对预览的动态库目录与 LocalBridge 日志中实际加载的目录。使用不同的构建位置或配置时，显式传参：

```bash
yarn update:mfw --binary-dir /path/to/lb --cwd /path/to/working-directory --config /path/to/config.json --dry-run
yarn update:mfw --lib-dir /path/to/MaaFramework/bin --dry-run
yarn update:mfw --version 5.13.0 --dry-run
```

确认预览后移除 `--dry-run` 执行。`--config` 支持 JSON；`--lib-dir` 优先于配置，但不会改写配置。更新目标必须是 MaaFramework 发行包专用的 `bin` 目录，其全部内容会被替换；不要指向系统命令目录或混放其他应用文件的目录。`--version` 只覆盖本次下载版本，不修改源码中的版本要求。

## 更新与恢复

更新前停止使用这份运行时的 LocalBridge 和 Agent。命令下载并校验发行包，确认动态库、MaaAgentServer 和非空的 MaaAgentBinary 存在后，再替换 `bin`、`share/MaaAgentBinary` 和 `.version`。OCR、配置和其他资源保持原位。即使版本标记相同也会重新安装，便于修复缺失或混装的组件。

临时网络失败每个请求最多重试 2 次，分别等待 5 秒和 15 秒。可通过 `GITHUB_TOKEN` 提高 GitHub API 请求额度；令牌只用于 API 请求。认证、证书、文件权限等错误不会重试。

更新成功后不保留旧版本备份。替换期间使用运行时根目录的 `.mpe-mfw-rollback-*` 临时保存旧组件，发生异常时自动尝试回滚；成功或回滚完成后会清理临时文件。若回滚未完成，会报告恢复文件的位置。不要混用不同版本的库和 Agent。

更新过程中使用 `.mpe-mfw-update.lock` 防止重复执行。进程意外终止后，确认更新进程已退出并检查组件和临时回滚文件状态，再移除残留锁。

重启 LocalBridge 后检查日志中的实际库路径、MaaFramework 初始化结果，并手动验证设备连接及一次识别/调试操作。下载校验通过不能替代真实加载验证；初始化仍报缺失符号时，应核对实际加载路径、目标版本及平台架构。

维护脚本测试：`yarn update:mfw:test`。测试只使用临时目录和构造的发行包，不更新本机运行时；macOS/Linux 测试额外需要 `zip`。
