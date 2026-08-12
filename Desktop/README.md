# Desktop 开发

Desktop 基于 Wails v2，构建脚本同时支持 Windows 与 macOS。开发前需安装 Go、Node.js、Yarn 和 Wails CLI，并先在仓库根目录执行：

```bash
yarn editor:install
```

常用命令：

```bash
yarn desktop:doctor
yarn desktop:dev
yarn desktop:build
```

`desktop:dev` 与 `desktop:build` 会自动构建 Editor、编译当前平台的 LocalBridge，并准备桌面端配置和 MaaFramework 运行时。

脚本默认读取一键安装器使用的 runtime 目录：

- Linux/macOS：`~/.local/bin/runtime`
- Windows：`%LOCALAPPDATA%\mpelb\runtime`

Wails CLI 会依次从 `MPE_WAILS_BIN`、`GOBIN`、`GOPATH/bin`、用户默认的 `go/bin` 和 `PATH` 中查找。运行时位于其他位置时，可设置 `MPE_RUNTIME_DIR`；其目录下应包含 `maafw/bin` 和 `resource`。

macOS/Linux：

```bash
MPE_RUNTIME_DIR=/path/to/runtime yarn desktop:build
```

Windows PowerShell：

```powershell
$env:MPE_RUNTIME_DIR = "D:\MPE\runtime"
yarn desktop:build
```

构建产物位置：

- macOS：`Desktop/build/bin/MaaPipelineEditor.app`
- Windows：`Desktop/build/bin/MaaPipelineEditor.exe`
