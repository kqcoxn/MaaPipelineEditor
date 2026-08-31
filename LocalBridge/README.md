# Local Bridge CLI

Local Bridge (lb) 是连接本地文件系统与 MaaPipelineEditor 前端的桥梁服务，基于 Go 语言开发，提供 WebSocket 通信和文件管理功能。

## 功能特性

### 已实现功能

- **本地文件协议**

  - 文件扫描：索引项目根目录内的 Project Interface，以及各 Bundle 的 `pipeline` 目录中的 `.json` 和 `.jsonc` 文件
  - 文件读取：读取并解析 JSON/JSONC 文件内容
  - 文件保存：保存编辑后的 pipeline 文件到本地
  - 文件创建：在指定目录创建新的 pipeline 文件
  - 文件监听：实时监听文件变化（新增、修改、删除）
  - 防抖处理：避免频繁的文件变化通知

- **WebSocket 服务**

  - 基于 RFC 6455 标准的 WebSocket 协议
  - 默认端口 9066，可配置
  - 连接超时 3 秒
  - 支持并发连接管理
  - 消息路由分发机制

- **架构特性**
  - 模块化设计，职责清晰
  - 事件驱动架构，模块间解耦
  - 插件化协议处理器，易于扩展
  - 统一的错误处理和日志系统
  - 路径安全验证，防止路径穿越攻击

### 暂不提供业务入口的基础协议

- MaaFramework 协议
- MaaMpeGoDebugger 协议
- Debug 状态协议
- AI HTTP 代理协议（普通与流式传输）

## 快速开始

### 编译

```bash
cd LocalBridge
go build -o mpelb.exe ./cmd/lb
```

### 运行

建议在 MaaFramework 项目根目录运行 LocalBridge。项目根目录通常包含 `interface.json`、资源目录和 Agent 目录；不要将单个 Bundle 或 `pipeline` 目录作为启动目录。

使用默认配置运行（根目录为当前目录，端口 9066）：

```bash
mpelb
```

指定根目录和端口：

```bash
mpelb --root ./MaaProject --port 9066
```

使用配置文件：

```bash
mpelb --config ./config/default.json
```

完整参数示例：

```bash
mpelb --root D:/MaaProject --port 9066 --log-level DEBUG --log-dir ./logs
```

### 配置文件

配置文件使用 JSON 格式，默认路径为 `./config/default.json`：

```json
{
  "server": {
    "port": 9066,
    "host": "localhost",
    "allowed_origins": [
      "https://mpe.codax.site",
      "http://localhost",
      "http://127.0.0.1",
      "http://[::1]"
    ]
  },
  "file": {
    "exclude": ["node_modules", ".git", "dist", "build"],
    "extensions": [".json", ".jsonc"],
    "max_depth": 10,
    "max_files": 10000
  },
  "log": {
    "level": "INFO",
    "dir": "./logs",
    "push_to_client": false
  },
  "maafw": {
    "enabled": false,
    "lib_dir": ""
  },
  "interface": {
    "path": ""
  }
}
```

文件根目录按 `--root`、配置文件 `file.root`、启动工作目录的顺序确定。默认配置不写入 `file.root`。`--root` 的相对路径以启动工作目录为基准；配置文件中的相对路径以配置文件所在目录为基准。命令行值仅对当前进程生效，不会在保存其他配置时写回配置文件。

## 命令行参数

| 参数          | 说明                                | 默认值   |
| ------------- | ----------------------------------- | -------- |
| `--config`    | 配置文件路径                        | 空       |
| `--root`      | MaaFramework 项目根目录             | `./`     |
| `--interface` | Project Interface V2 入口路径       | 自动检索 |
| `--port`      | WebSocket 监听端口                  | `9066`   |
| `--log-dir`   | 日志输出目录                        | `./logs` |
| `--log-level` | 日志级别 (DEBUG, INFO, WARN, ERROR) | `INFO`   |

命令行参数优先级高于配置文件。

## WebSocket API

### 连接

- **地址**: `ws://localhost:9066`
- **协议**: WebSocket (RFC 6455)

### 消息格式

所有消息采用 JSON 格式：

```json
{
  "path": "/路由路径",
  "data": {
    /* 路由特定的数据 */
  }
}
```

### 路由约定

- `/lte/*`: Local Bridge → Editor（服务端推送）
- `/etl/*`: Editor → Local Bridge（客户端请求）
- `/ack/*`: 确认消息（双向）
- `/error`: 错误消息（双向）

### 本地文件协议 API

#### 1. 文件列表推送 `/lte/file_list`

**方向**: lb → mpe  
**触发**: 连接建立时自动推送

```json
{
  "path": "/lte/file_list",
  "data": {
    "root": "/absolute/path/to/root",
    "files": [
      {
        "file_path": "/absolute/path/to/file.json",
        "file_name": "file.json",
        "relative_path": "pipeline/file.json"
      }
    ]
  }
}
```

#### 2. 打开文件 `/etl/open_file`

**方向**: mpe → lb

```json
{
  "path": "/etl/open_file",
  "data": {
    "file_path": "/absolute/path/to/file.json"
  }
}
```

**响应**: `/lte/file_content`

```json
{
  "path": "/lte/file_content",
  "data": {
    "file_path": "/absolute/path/to/file.json",
    "content": {
      /* pipeline JSON */
    }
  }
}
```

#### 3. 保存文件 `/etl/save_file`

**方向**: mpe → lb

```json
{
  "path": "/etl/save_file",
  "data": {
    "file_path": "/absolute/path/to/file.json",
    "content": {
      /* pipeline JSON */
    }
  }
}
```

**响应**: `/ack/save_file`

```json
{
  "path": "/ack/save_file",
  "data": {
    "file_path": "/absolute/path/to/file.json",
    "status": "ok"
  }
}
```

#### 4. 创建文件 `/etl/create_file`

**方向**: mpe → lb

```json
{
  "path": "/etl/create_file",
  "data": {
    "file_name": "new_pipeline.json",
    "directory": "/absolute/path/to/dir",
    "content": {
      /* 可选的初始内容 */
    }
  }
}
```

**响应**: 自动推送更新后的文件列表 `/lte/file_list`

#### 5. 文件变化通知 `/lte/file_changed`

**方向**: lb → mpe  
**触发**: 文件被外部修改时自动推送

```json
{
  "path": "/lte/file_changed",
  "data": {
    "type": "created" | "modified" | "deleted",
    "file_path": "/absolute/path/to/file.json"
  }
}
```

### 错误处理

错误消息格式：

```json
{
  "path": "/error",
  "data": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "detail": {
      /* 可选的详细信息 */
    }
  }
}
```

错误码：

| 错误码               | 说明               |
| -------------------- | ------------------ |
| `FILE_NOT_FOUND`     | 文件不存在         |
| `FILE_READ_ERROR`    | 文件读取失败       |
| `FILE_WRITE_ERROR`   | 文件写入失败       |
| `FILE_NAME_CONFLICT` | 文件名冲突         |
| `INVALID_JSON`       | JSON 格式无效      |
| `PERMISSION_DENIED`  | 权限不足或路径非法 |
| `INVALID_REQUEST`    | 请求参数无效       |

## 项目结构

```
LocalBridge/
├── cmd/
│   └── lb/
│       └── main.go                    # CLI 入口
├── internal/
│   ├── server/
│   │   ├── websocket.go               # WebSocket 服务器
│   │   └── connection.go              # 连接管理
│   ├── router/
│   │   └── router.go                  # 路由分发器
│   ├── protocol/
│   │   └── file/
│   │       └── file_handler.go        # 文件协议处理器
│   ├── service/
│   │   └── file/
│   │       ├── file_service.go        # 文件服务
│   │       ├── scanner.go             # 文件扫描器
│   │       └── watcher.go             # 文件监听器
│   ├── config/
│   │   └── config.go                  # 配置管理
│   ├── logger/
│   │   └── logger.go                  # 日志系统
│   ├── eventbus/
│   │   └── eventbus.go                # 事件总线
│   └── errors/
│       └── errors.go                  # 错误处理
├── pkg/
│   └── models/
│       ├── file.go                    # 文件模型
│       └── message.go                 # 消息模型
├── config/
│   └── default.json                   # 默认配置
├── go.mod
└── README.md
```

## 日志

日志输出到两个位置：

1. **控制台**：实时查看运行状态
2. **文件**：保存在 `<log-dir>/lb-YYYY-MM-DD.log`，按日期切分

日志格式：

```
[时间戳][级别][模块] 消息内容
```

示例：

```
[14:32:15][INFO][WebSocket] 客户端已连接: 127.0.0.1:52341
[14:32:16][INFO][File] 扫描到 12 个 pipeline 文件
[14:32:20][WARN][File] 文件已被外部修改: task.json
```

## 开发指南

### 添加新协议

1. 在 `internal/protocol/` 下创建新目录（如 `maafw/`）
2. 实现 `router.Handler` 接口：
   ```go
   type Handler interface {
       GetRoutePrefix() []string
       Handle(msg models.Message, conn *server.Connection) *models.Message
   }
   ```
3. 在 `cmd/lb/main.go` 中注册处理器

### 事件系统

使用事件总线实现模块间通信：

```go
// 发布事件
eventBus.Publish("event.type", data)

// 订阅事件
eventBus.Subscribe("event.type", func(event eventbus.Event) {
    // 处理事件
})
```

内置事件：

- `file.scan.completed`: 文件扫描完成
- `file.changed`: 文件变化
- `connection.established`: 连接建立
- `connection.closed`: 连接关闭

## 许可证

本项目遵循与 MaaPipelineEditor 相同的许可证。

## 参考资料

- [Local Bridge 协议规范](./Agreement.md)
- [MaaFramework Go Binding](https://github.com/MaaXYZ/maa-framework-go)
