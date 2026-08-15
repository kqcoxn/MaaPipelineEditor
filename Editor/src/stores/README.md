# Store 目录

Store 按状态所属的业务域组织：

- `app`：应用配置、错误与日志等全局状态。
- `connection`：LocalBridge WebSocket 与 MaaFramework 连接状态。
- `project`：项目文件、本地资源和自定义模板状态。
- `flow`：画布、节点、边、剪贴板与操作历史状态。
- `debug`：调试会话、运行配置、轨迹和诊断状态。
- `embed`：嵌入模式及其消息日志状态。
- `ui`：工具栏、面板占位和引导等纯界面状态。

跨域引用使用 `@/stores/<domain>/<store>`，域内实现可以使用相对路径。
