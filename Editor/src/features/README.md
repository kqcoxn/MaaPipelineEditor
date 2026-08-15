# Feature 目录

Feature 按业务域组织，域内实现再按职责分层：

- `actions`：用户操作、跨 Store 更新和带副作用的命令。
- `components`：业务域内的 React UI 与 UI 调用封装。
- `contributions`：可扩展注册项及其默认贡献。
- `hooks`：业务域内的 React Hooks。
- `protocols`：宿主协议、协议监听器和生命周期注册。
- `selectors`：从 Store 或协议数据派生业务数据。
- `state`：业务状态转换器和 Reducer。
- `types`：业务域共享的类型与常量。
- `utils`：格式化、转换和小型领域辅助逻辑。

业务域之间引用使用 `@/features/<domain>/...`，同一业务域内优先使用相对路径。测试文件与被测实现放在同一职责目录中。
