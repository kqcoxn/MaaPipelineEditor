---
trigger: model_decision
description: 需要调用工程化工具时启用
---


# 工程化方案

## 前端工程化

### 包管理工具
- **Yarn**: 项目使用 Yarn 作为包管理工具
  - 版本管理和依赖安装
  - 脚本执行和任务管理

### 构建工具
- **Vite**: 现代化的前端构建工具
  - 快速的开发服务器
  - 高效的生产构建
  - 原生 ESM 支持

### 代码质量
- **TypeScript**: 类型安全的 JavaScript 超集
  - 静态类型检查
  - 更好的代码提示和重构支持

### 开发流程
- 使用 `yarn install` 安装依赖
- 使用 `yarn dev` 启动开发服务器
- 使用 `yarn build` 构建生产版本
- 使用 `yarn preview` 预览生产构建

### 代码规范
- ESLint 用于代码质量检查
- Prettier 用于代码格式化（如配置）
