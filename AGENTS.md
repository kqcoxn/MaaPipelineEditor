# AGENTS.md

## 项目地址

- 名称：MaaPipelineEditor (mpe)
- 地址：https://github.com/kqcoxn/MaaPipelineEditor

## 项目结构

- **前端（editor）**：`/src`
- **后端（localbridge / lb）**：`/LocalBridge`
- **客户端（extremer）**：`/Extremer`
- **页面嵌入测试（iframe）**：`/Iframe`
- **文档站（docsite）**：`/docsite`
- **展示页/主页（landing）**：`/Landing`

> 默认开发需同时完善前后端；客户端由构建流程自动生成。

## 开发准则

- 始终使用中文与我交流
- 使用 `yarn` 作为包管理器
- 新功能若与现有功能有关，应尽可能复用现有函数，在合适时可以进行方法封装或提升
- 前后端单个文件不应过大，超过时应该分模块封装（可以顺手拆分或重构）
- 不论前后端，实现不考虑旧版本兼容性，废弃内容直接移除（除非特别说明）
- 不要自动执行 `yarn dev` 开启服务器或打开内嵌页面检查，也不要使用浏览器测试,前后端也不用跑构建检测。需要时仅语法检测即可，并在需要测试时，最后告诉我应该测哪些地方，我自行人工复核
