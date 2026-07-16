# AGENTS.md

## 项目地址

- 名称：MaaPipelineEditor (mpe)
- 地址：https://github.com/kqcoxn/MaaPipelineEditor

## 项目结构

- **前端（editor）**：`/Editor`
- **后端（localbridge / lb）**：`/LocalBridge`
- **桌面客户端（desktop）**：`/Desktop`
- **页面嵌入测试（iframe）**：`/Iframe`
- **文档站**：`/DocumentStation`
- **展示页/主页（landing）**：`/Landing`

> 默认开发需同时完善前后端；客户端由构建流程自动生成。
> 根目录 `package.json` 仅提供仓库级命令代理；Editor 依赖使用 `yarn editor:install` 安装。

## 开发准则

- 始终使用中文与我交流
- 使用 `yarn` 作为包管理器
- 新功能若与现有功能有关，应尽可能复用现有函数，在合适时可以进行方法封装或提升
- 前后端单个文件不应过大，超过时应该分模块封装（可以顺手拆分或重构）
- 不论前后端，实现不考虑旧版本兼容性，废弃内容直接移除（除非特别说明）
- 前端交互上的更新，不要自动执行 `yarn dev` 开启服务器或打开内嵌页面检查，也不要使用浏览器测试，我手动测试即可（在对话最后告诉我需要测哪些内容）
- 在需要参考相关社区项目时，可按 `dev\docs\社区参考项目索引.md` 推荐进行参考
