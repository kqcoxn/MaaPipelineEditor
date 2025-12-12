<p align="center">
  <img alt="LOGO" src="./public/logo.png" width="256" height="256" />
</p>

<div align="center">

# MaaPipelineEditor

_✨ 可视化构建 MaaFramework Pipeline 的下一代工作流编辑器 ✨_</br>🛠️ 告别手调千行 JSON！用拖拽+配置的方式，高效构建、分享你的 Maa 自动化流程 🛠️

</div>

<p align="center">
  <a href="https://react.dev/" target="_blank"><img alt="react" src="https://img.shields.io/badge/React 19-%2320232a.svg?logo=react&logoColor=%2361DAFB"></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img alt="ts" src="https://img.shields.io/badge/TypeScript 5.8-3178C6?logo=typescript&logoColor=fff"></a>
  <a href="https://reactflow.dev/" target="_blank"><img alt="react-flow" src="https://img.shields.io/badge/React Flow 12-%23ff0072?logoColor=fff&logo=flathub"></a>
  <br/>
  <a href="https://github.com/kqcoxn/MaaPipelineEditor/blob/main/LICENSE.md" target="_blank"><img alt="committs" src="https://img.shields.io/github/license/kqcoxn/MaaPipelineEditor"></a>
  <a href="https://github.com/kqcoxn/MaaPipelineEditor/stargazers" target="_blank"><img alt="stars" src="https://img.shields.io/github/stars/kqcoxn/MaaPipelineEditor?style=social"></a>
  <a href="https://github.com/kqcoxn/MaaPipelineEditor/commits/main/" target="_blank"><img alt="committs" src="https://img.shields.io/github/commit-activity/m/kqcoxn/MaaPipelineEditor?color=%23ff69b4"></a>
</p>

<div align="center">

[🚀 在线使用](https://mpe.codax.site/stable) | [📖 文档](https://mpe.codax.site/docs) | [💬 讨论反馈](#讨论与帮助)

</div>

## 简介

**MaaPipelineEditor (MPE)** 是一款前后端完全分离架构、运用 [YAMaaPE](https://github.com/kqcoxn/YAMaaPE) 开发经验去芜存菁、经过资源开发者充分微调的 [MaaFramework](https://github.com/MaaXYZ/MaaFramework) [Pipeline](https://maafw.xyz/docs/3.1-PipelineProtocol.html) 工作流式可视化编辑器。

**_“由您设计，由我们支持。”_** 如您所需皆已存在：添加、配置、连接，只需稍作思考，想法之外尽在其中！

## 亮点

- **✨ 极致轻量，开箱即用**：无需安装、无需配置，打开 [在线编辑器 🌐](https://mpe.codax.site/stable) 即可开始可视化 Pipeline 编辑之旅。真正意义上跨平台、可集成，随时随地 🖥💻 甚至纯文本查看与编辑项目 。
- **🚀 渐进扩展，模块增强**通过一行命令即可增量启用 [本地服务](https://mpe.codax.site/docs/guide/start/local-server.html)，无缝接入文件管理、截图工具等本地能力，支持自定义框架与 OCR 路径，直接对齐本地环境。
- **🧠 所见即所思，流程即逻辑**：注重编辑功能，更注重阅读体验！多种节点样式 🎨 匹配不同数据偏好，布局紧凑、逻辑清晰，让复杂任务一目了然 🧩。
- **🧰 全面辅助，模板自由**：内置识别小工具（文本识别、截图裁剪、取色框选等 🎯），搭配丰富节点预制模板 📦，并支持创建与保存自定义模板 —— 重复工作，一次配置，处处复用 ♻️！
- **🔄 全面兼容，平滑迁移**：完整支持 v1 与 v2 协议混合使用，旧项目一键导入 ✅；自动识别废弃字段并智能迁移，涵盖复合类型等高级结构，并提供自动排版功能 —— 迁移从未如此轻松 🛠️。
- **⌨️ 类原生交互，高效编辑**：单面板分类字段添加，减少上下文切换；字段编辑媲美 IDE 级体验 💡，内置多种语法糖 🍬，大幅简化类型配置与结构书写。
- **🤖 AI 赋能，未来已来**：智能节点搜索已上线 🔍，精准推荐、快速定位；更多 AI 辅助功能正在路上 🚧——让 Pipeline 编辑更聪明、更自然 ✨。
- **➕ 更多功能，还有高手**：当前正在开发流程级调试功能！预计 `12.17` 前实装。

> [!IMPORTANT]
> 如果您有更多的需求或优化建议，欢迎提交 ISSUE，我们真的非常在意您的体验！

## 展示

您可以使用 MPE 在各类便捷工具的加持下轻松构造出如下 Pipeline，**兼具易用性与可读性**：

![](./image/展示.png)

（演示 Pipeline：[MNMA-城市探索.json](https://github.com/kqcoxn/MaaNewMoonAccompanying/blob/v3.1.8/assets/resource/base/pipeline/%E6%97%A5%E5%B8%B8%E6%B4%BB%E5%8A%A8/%E5%9F%8E%E5%B8%82%E6%8E%A2%E7%B4%A2.json), 3529 lines）

**MPE 正在进行一轮 [精细化重定位](https://github.com/kqcoxn/MaaPipelineEditor/issues/31)**，将为您提供能加细分的业务需求解决方案！目前，您可以使用一行命令下载并安装 MPE 的 [本地服务](https://mpe.codax.site/docs/guide/start/local-server.html)，**渐进式模块化补充编辑器的功能**，兼具灵活性与功能性：

![](./image/big-pie.png)

## 开箱即用

- [文档站](https://mpe.codax.site/docs)
- [稳定版](https://mpe.codax.site/stable)_**（推荐！）**_
- [预览版](https://kqcoxn.github.io/MaaPipelineEditor/)（最新 commit）

> [!IMPORTANT]
> 在每次框架版本迭代时，MPE 的部分特性适配可能存在延迟或遗漏。若您发现相关问题，请提交 ISSUE 或 PR，或在集成开发交流群内指正。

## 讨论与帮助

MPE 项目没有单独的交流群，您可以在 MaaFramework 集成/开发交流 QQ 群（[595990173](https://qm.qq.com/q/gqSv6ukjV8)）询问相关问题或参与讨论。

## 鸣谢

### 开发者

感谢以下开发者对 MaaPipelineEditor 作出的贡献：

[![贡献者](https://contrib.rocks/image?repo=kqcoxn/MaaPipelineEditor)](https://github.com/kqcoxn/MaaPipelineEditor/graphs/contributors)

### 特别感谢

- [MaaFramework](https://github.com/MaaXYZ/MaaFramework)
- [Mirror 酱](https://mirrorchyan.com)

## 其他

- 原项目备份仓库：https://github.com/kqcoxn/YAMaaPE

## 统计

[![Star History Chart](https://api.star-history.com/svg?repos=kqcoxn/MaaPipelineEditor&type=Date)](https://www.star-history.com/#kqcoxn/MaaPipelineEditor&Date)
