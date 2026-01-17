---
trigger: always_on
alwaysApply: true
---

## 项目地址

https://github.com/kqcoxn/MaaPipelineEditor

## 关于项目
MaaPipelineEditor 简称 mpe 由以下三部分组成：

- 前端指 editor 部分，代码在`/src`下面
- 后端指 localbridge (lb) 部分，代码在`/LocalBridge`下面
- 客户端指 extremer 部分，代码在`/Extremer`下面

在完善功能时，若无特殊强调，应该同时完善前后端，以保证功能完整。客户端依靠前后端在打包时自动构建，一般不用管。

## 应该做的事

- 当需要调用新的 react-flow 与 maafw/pipeline 功能时，应该参阅`/instructions`下的相关参考文档，不要凭空生成
- 使用`yarn`作为 Node.js 的包管理器

## 禁止的工作

- 不要帮我`yarn dev`，一般我是一直开着的
- 不要自动帮我构建测试脚本
