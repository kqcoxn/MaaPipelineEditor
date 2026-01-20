---
trigger: always_on
alwaysApply: true
---

## 关于项目

项目地址：https://github.com/kqcoxn/MaaPipelineEditor

MaaPipelineEditor 简称 mpe，由以下三部分组成：

- **前端**：指 **editor** 部分，代码在`/src`下面
- **后端**：指 **localbridge** (lb) 部分，代码在`/LocalBridge`下面
- **客户端**：指 **extremer** 部分，代码在`/Extremer`下面

在完善功能时，若无特殊强调，应该同时完善前后端，以保证功能完整。客户端依靠前后端在打包时自动构建，一般不用管。

## 应该做的事

- 当需要调用新的 react-flow 与 maafw/pipeline 功能时，应该参阅`/instructions/`下的相关参考文档，不要凭空生成（各文档目录见“参考文档”）
- 使用`yarn`作为 Node.js 的包管理器

## 禁止的工作

- 不要考虑兼容旧版本，除非我特别说明
- 不要帮我`yarn dev`，一般我是一直开着的
- 不要自动帮我构建测试脚本与总结文档

## 参考文档

各文档存放位置：`/instructions/`

- **mfw 使用方式 / pipeline 相关**: `/instructions/maafw-guide/`（`maaframework` 可缩写为 `maafw`、`mfw`，`maafw-guide`偏应用向）
- **mfw golang binding**: `/instructions/maafw-golang-binding/`（`maafw-golang-binding`偏底层调用）
- **ant-design 官方使用文档**：`/instructions/ant-design/`（`ant-design` 可缩写为 `antd`）
- **react-flow 官方使用文档**：`/instructions/react-flow/`
- **wails 官方使用文档**：`/instructions/wails/`

当需要其他框架 API 但本地没有时可视情况自动网络检索
