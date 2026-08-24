---
name: sync-reference-projects
description: 同步 MaaPipelineEditor 的 MaaFramework 社区参考项目。当用户说“同步项目”“同步参考项目”或要求更新社区参考仓库时使用；不用于同步 MPE 自身仓库。
---

执行参考项目同步前，先读取 `dev/docs/社区参考项目索引.md`，确认项目清单和脚本约定。

该同步流程是 MPE 社区参考源码的唯一补齐和更新入口。参考项目缺失或需要更新时，不要在系统临时目录、工作区内部或其他旁路位置手动 `git clone`；通过下述仓库级命令维护索引登记的本地副本。同步完成后的调研应直接读取 `../maa-refs` 下的仓库。

在仓库根目录执行：

```bash
yarn sync:references
```

该命令使用 Node.js 调用系统 `git`，Windows 与 macOS 均可直接运行，不依赖 PowerShell。脚本的默认目标是与 MPE 同级的 `maa-refs` 目录。它会克隆不存在的仓库，或对可安全快进的仓库执行更新；存在本地修改、detached HEAD 或没有 upstream 的仓库只会 fetch，不覆盖本地状态。

汇报每个项目的同步结果。失败不应阻止其他项目继续同步；如脚本返回非零退出码，说明失败项目和原因，不要自动重试或清理用户本地修改。
