# 脚本目录

## Yarn 命令

根目录 `package.json` 只保留常用手动入口，同类命令连续排列。常用入口与 Git 操作直接使用短名称，其他入口使用 `ed`、`lb`、`desk`、`refs`、`web` 短前缀。子项目内的命令不加前缀。

| 范围 | 根目录命令 |
| --- | --- |
| 编辑器 | `ed:install`、`dev`、`ed:build` |
| 本地服务 | `server`、`lb:deps`（含 OCR）、`lb:update`（仅 MaaFramework 与 Agent） |
| 桌面端 | `desk:install`、`desk:prepare`、`desk`、`desk:build`、`revision` |
| 文档与参考资料 | `doc`、`refs:sync` |
| 展示页 | `web:dev`、`web:build` |
| 版本维护 | `migrate`、`proto` |
| Git 操作 | `release`（创建并推送版本标签）、`retag`（删除本地版本标签）、`reset`（软重置上一次提交） |

`yarn desk` 先执行 `desk:prepare` 检查运行时、构建并安装本地 Editor 与 LocalBridge，再启动桌面开发界面；任一步失败即停止。执行前需停止正在运行的 mpelb 服务。

检查、测试及低频工具直接从对应子目录运行，也可在根目录使用 `--cwd`：

| 子项目 | 调用方式 |
| --- | --- |
| 编辑器 | `yarn --cwd Editor <命令>`：`lint`、`preview`、`icon`、`build-past`、`generate`、`test` |
| 本地服务 | `yarn --cwd LocalBridge <命令>`：`build`、`run`、`test` |
| 桌面端 | `yarn --cwd Desktop <命令>`：`check`、`test` |
| 展示页 | `yarn --cwd Landing <命令>`：`verify`、`preview` |

## 文件归档

仓库级自动化统一收口在此目录，并按运行场景分类：

| 目录 | 用途 | 典型调用方 |
| --- | --- | --- |
| `ci/` | 持续集成与发布流程专用脚本 | GitHub Actions |
| `development/` | 需要开发者主动运行的仓库维护脚本 | `yarn` 命令或命令行 |
| `docs/` | 文档与参考资料维护脚本及配置清单 | 文档维护者 |
| `install/` | 面向最终用户分发的一键安装入口 | PowerShell、CMD、Shell |
| `web/` | 独立的网页辅助文件 | 手动部署或预览 |

子项目独占的脚本继续放在对应项目内，例如 `Editor/scripts/`、`Landing/scripts/`。新增仓库级脚本时，应按实际调用场景放入上述目录，避免在 `.github/`、`dev/` 或根目录新增零散入口。
