```md
# Project Context

## 项目基本信息

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

# Development Rules

## 必须遵守

- 使用 `yarn` 作为包管理器
- 新功能需参考 `/dev/instructions/` 下的官方文档，禁止凭空生成无根据的函数
- 新功能若与现有功能有关，应尽可能复用现有函数，在合适时可以进行方法封装或提升
- 在合适的时候自主调用相关 skill

## 建议执行

- 前后端单个文件不要超过 800 行，超过时应该分模块封装（可以顺手重构）

## 禁止行为

- 不考虑旧版本兼容性，废弃内容直接移除（除非特别说明）
- 不要执行 `yarn dev` 开启服务器或打开内嵌页面
- 不要自动生成测试脚本、总结或说明文档
- 前后端不用跑构建检测，需要时仅语法检测即可
- 不要使用浏览器测试，我自己测即可

# Reference Guide

## 本地文档路径

- MaaFramework（可用 `mfw` 或 `maafw` 指代） 应用指南：`/dev/instructions/maafw-guide/`
- MaaFramework Go 绑定：`/dev/instructions/maafw-golang-binding/`（localbridge 所需）
- Ant Design（可缩写为 `antd`）：`/dev/instructions/ant-design`
- React Flow：`/dev/instructions/react-flow/`
- Wails：`/dev/instructions/wails/`

> 若需其他框架 API 且本地无文档，可联网检索。
> 文档内的内容不要修改，相当于只读。
```
