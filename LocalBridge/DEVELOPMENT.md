# Local Bridge 开发文档

## 已完成功能

### 核心架构

✅ **分层架构设计**

- 应用层：CLI 入口和生命周期管理
- 业务层：文件服务、MaaFW 服务（预留）
- 协议层：路由分发、协议处理器
- 传输层：WebSocket 服务器、连接管理
- 基础设施层：日志、配置、事件总线、错误处理

✅ **模块化组件**

- 配置管理：支持配置文件和命令行参数
- 日志系统：分级输出、文件记录、可选的客户端推送
- 事件总线：发布-订阅模式，模块间解耦
- 错误处理：统一错误码定义和错误消息格式

### 本地文件协议

✅ **文件扫描**

- 递归扫描根目录
- 支持 `.json` 和 `.jsonc` 文件
- 可配置排除目录列表
- 构建文件索引缓存

✅ **文件操作**

- 读取文件：JSON/JSONC 解析
- 保存文件：格式化 JSON 输出（2 空格缩进）
- 创建文件：新建 pipeline 文件
- 路径安全验证：防止路径穿越攻击

✅ **文件监听**

- 基于 fsnotify 的实时监听
- 支持文件新增、修改、删除事件
- 防抖处理（300ms 窗口期）
- 自动更新文件索引

✅ **WebSocket 通信**

- 基于 gorilla/websocket 实现
- 支持并发连接管理
- 消息路由分发机制
- 广播和单播消息发送

### 可扩展性设计

✅ **插件化协议处理器**

- 统一的 Handler 接口
- 路由前缀注册机制
- 支持动态添加新协议

✅ **预留功能接口**

- MaaFramework 服务模块（未实现）
- Debug 协议处理器（未实现）
- AI 流协议处理器（未实现）

## 构建与运行

### 构建

```bash
# 编译为可执行文件
cd LocalBridge
go build -o lb.exe ./cmd/lb

# 构建所有模块（验证编译）
go build ./...

# 下载依赖
go mod tidy
```

### 运行示例

```bash
# 使用默认配置
./lb.exe

# 指定根目录
./lb.exe --root D:/pipelines

# 完整参数
./lb.exe --root D:/pipelines --port 9066 --log-level DEBUG
```

## 下一步工作（建议）

### MaaFramework 集成

1. 创建 `internal/service/maafw/` 目录
2. 实现 MaaFramework 初始化和生命周期管理
3. 封装 Tasker、Resource、Controller 操作
4. 创建 `internal/protocol/maafw/` 协议处理器
5. 设计 MaaFramework 相关的 WebSocket API
6. 实现事件回调转发到 mpe

### 测试完善

1. 编写单元测试

   - 文件扫描逻辑测试
   - JSON 序列化/反序列化测试
   - 错误处理测试
   - 路由匹配测试

2. 集成测试

   - WebSocket 连接和消息收发
   - 文件操作完整流程
   - 文件监听和通知流程

3. 性能测试
   - 大量文件扫描性能
   - 并发连接处理
   - 消息吞吐量

### 功能增强

1. 日志推送到客户端
2. 配置热重载
3. 文件内容缓存优化
4. 更完善的错误恢复机制
5. 健康检查接口

## 技术栈

- **语言**: Go 1.23
- **WebSocket**: gorilla/websocket
- **文件监听**: fsnotify
- **CLI 框架**: spf13/cobra
- **配置管理**: spf13/viper
- **日志**: sirupsen/logrus

## 项目结构概览

```
LocalBridge/
├── cmd/lb/main.go              # CLI 入口，组装所有模块
├── internal/
│   ├── config/                 # 配置管理
│   ├── errors/                 # 错误定义
│   ├── eventbus/               # 事件总线
│   ├── logger/                 # 日志系统
│   ├── protocol/file/          # 文件协议处理器
│   ├── router/                 # 路由分发器
│   ├── server/                 # WebSocket 服务器
│   └── service/file/           # 文件服务（扫描、监听、读写）
├── pkg/models/                 # 数据模型
└── config/default.json         # 默认配置
```

## 贡献指南

添加新协议的步骤：

1. 在 `internal/service/` 创建业务服务
2. 在 `internal/protocol/` 创建协议处理器
3. 实现 `router.Handler` 接口
4. 在 `cmd/lb/main.go` 注册处理器
5. 更新 README 文档

## 注意事项

- 所有文件操作前必须进行路径安全验证
- 文件监听事件需要防抖处理
- WebSocket 消息发送需要考虑并发安全
- 错误必须通过统一的错误处理模块
- 日志应包含模块名称便于追踪
