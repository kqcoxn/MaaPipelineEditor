# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:

- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

## Subagents

- ALWAYS wait for all subagents to complete before yielding.
- Spawn subagents automatically when:
  - Parallelizable work (e.g., install + verify, npm test + typecheck, multiple tasks from plan)
  - Long-running or blocking tasks where a worker can run independently.
  - Isolation for risky changes or checks

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

# Development Rules

## 必须遵守

- 使用 `yarn` 作为包管理器
- 新功能需参考 `/dev/instructions/` 下的官方文档，禁止凭空生成无根据的函数
- 新功能若与现有功能有关，应尽可能复用现有函数，在合适时可以进行方法封装或提升
- 在合适的时候自主调用相关 skill
- 如果要撰写 prd、ttd、临时文档等需要放在 `\dev\design` 下

## 建议执行

- 前后端单个文件不要超过 800 行，超过时应该分模块封装（可以顺手重构）

## 禁止行为

- 不考虑旧版本兼容性，废弃内容直接移除（除非特别说明）
- 不要执行 `yarn dev` 开启服务器或打开内嵌页面
- 不要自动生成测试脚本、总结或说明文档（但可更新PRD文档）
- 前后端不用跑构建检测，需要时仅语法检测即可
- 不要使用浏览器测试，我自己测即可

# Reference Guide

## 本地文档路径

- MaaFramework（可用 `mfw` 或 `maafw` 指代） 应用指南：`/dev/instructions/maafw-guide/`
- MaaFramework Go 绑定：`/dev/instructions/maafw-golang-binding/`（localbridge 所需）
- Ant Design（可缩写为 `antd`）：`/dev/instructions/ant-design`
- React Flow：`/dev/instructions/react-flow/`
- Wails：`/dev/instructions/wails/`
- 临时文档（如当前开发模块所参考的各项目 wiki）：`/dev/instructions/.tmp/`（我说参考非上面的文档时，那一般就在这里面）

> 若需其他框架 API 且本地无文档，可联网检索。
> 当文档细粒度不够时，可以自行检索 github 源码进行参考
> 文档内的内容不要修改，相当于只读。
