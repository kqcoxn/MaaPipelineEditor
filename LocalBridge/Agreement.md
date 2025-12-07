# Local Bridge 协议

Local Bridge (简称 lb) 是打通本地服务与前端界面 (简称 mpe) 的桥梁，以操作 maaframework-golang 为主，使用 go 语言与 websocket 协议实现

## 通用协议

### 连接管理

- **协议**: WebSocket (RFC 6455)
- **默认端口**: `9066`（可配置）
- **服务地址**: `ws://localhost:{port}`
- **连接超时**: 3 秒
- **重连策略**: 不自动重连，由用户手动触发

连接流程：

1. mpe 发起连接请求到 `ws://localhost:{port}`
2. lb 接受连接，返回握手成功
3. lb 主动推送根目录下的文件列表
4. 连接保持打开状态，直到主动断开或异常中断

断开处理：

- 连接断开时，mpe 显示「已断开」状态
- 不进行自动重连，等待用户手动点击重新连接

### 数据同步

数据同步遵循以下原则：

1. **单向主导**: 以 mpe 编辑内容为主，lb 负责持久化
2. **显式保存**: 仅在用户点击「应用到本地」时才写入文件
3. **文件标识**: 使用文件的绝对路径作为唯一标识
4. **冲突处理**: 当本地文件被外部修改时，lb 通知 mpe，由用户决定是否重新加载

### 消息规范

所有消息采用 JSON 格式：

```json
{
  "path": "/路由路径",
  "data": {
    /* 路由特定的数据 */
  }
}
```

路由命名约定：

- **`/lte/*`**: lb to editor，lb → mpe
- **`/etl/*`**: editor to lb，mpe → lb
- **`/ack/*`**: 确认消息（双向）
- **`/error`**: 错误消息（双向）

## 本地文件协议

本地文件协议定义了文件读取与回传的全流程。

### 根目录配置

lb 启动时需指定一个根目录作为文件扫描范围：

- **配置方式**: 命令行参数 `--root <path>` 或配置文件
- **默认值**: 当前工作目录
- **扫描规则**:
  - 递归扫描所有 `.json` 与 `.jsonc` 文件
  - 排除 `node_modules`、`.git` 等常见忽略目录
  - 可通过配置文件自定义排除规则

### 初始化与文件读取

期望场景：

1. lb 递归的发送指定根目录下所有 `.json` 与 `.jsonc` 文件信息（含文件路径、文件名）给 mpe
2. mpe 面板中可选读取某一个文件进入，加载进 mpe 的文件 tab 栏

其中，当 tab 栏中已有指定 pipeline 时，应该跳转到其 flow 而不是新建

文件信息结构：

```json
{
  "file_path": "/absolute/path/to/file.json",
  "file_name": "file.json",
  "relative_path": "pipeline/file.json"
}
```

### 文件保存

期望场景：

1. 当点击 mpe 导出到本地按钮时，mpe 将 json 发送给 lb，lb 替换本地文件内容
2. 当 mpe 新建文件时，应该先弹出命名面板，在确定名称后通知 lb 在本地新建此文件，并重新读取文件信息列表（注意，本地的文件名称与 flow 中的 filename 不是一个东西，flow 中的 filename 仅用于在 mpe 中区分文件，因此也不能重复，需要本地与 mpe 双重检查）

### 文件变化监听

lb 应监听根目录下文件的变化：

- **新增文件**: 通知 mpe 更新文件列表
- **删除文件**: 通知 mpe 更新文件列表，若该文件已在 tab 中打开则标记为「已删除」
- **外部修改**: 通知 mpe 文件已被外部修改，由用户决定是否重新加载
- **防抖处理**: 文件变化事件应做防抖处理，避免频繁通知

### 错误处理机制

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

常见错误码：

| 错误码               | 说明          |
| -------------------- | ------------- |
| `FILE_NOT_FOUND`     | 文件不存在    |
| `FILE_READ_ERROR`    | 文件读取失败  |
| `FILE_WRITE_ERROR`   | 文件写入失败  |
| `FILE_NAME_CONFLICT` | 文件名冲突    |
| `INVALID_JSON`       | JSON 格式无效 |
| `PERMISSION_DENIED`  | 权限不足      |

### WebSocket API

#### lb → mpe 路由

**`/lte/file_list`** - 推送文件列表

```json
{
  "path": "/lte/file_list",
  "data": {
    "root": "/absolute/path/to/root",
    "files": [
      { "file_path": "...", "file_name": "...", "relative_path": "..." }
    ]
  }
}
```

**`/lte/file_content`** - 返回文件内容

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

**`/lte/file_changed`** - 通知文件变化

```json
{
  "path": "/lte/file_changed",
  "data": {
    "type": "created" | "modified" | "deleted",
    "file_path": "/absolute/path/to/file.json"
  }
}
```

#### mpe → lb 路由

**`/etl/open_file`** - 请求打开文件

```json
{
  "path": "/etl/open_file",
  "data": {
    "file_path": "/absolute/path/to/file.json"
  }
}
```

**`/etl/save_file`** - 保存文件到本地

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

**`/etl/create_file`** - 新建文件

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

**`/etl/refresh_file_list`** - 请求刷新文件列表

```json
{
  "path": "/etl/refresh_file_list",
  "data": {}
}
```

请求后 lb 会重新推送 `/lte/file_list`。

#### 确认消息

**`/ack/save_file`** - 保存成功确认

```json
{
  "path": "/ack/save_file",
  "data": {
    "file_path": "/absolute/path/to/file.json",
    "status": "ok"
  }
}
```

## MaaFrameowrk 协议

// TODO（现在不用管）

## MaaMpeGoDebugger

// TODO（现在不用管）

## Debug 状态协议

// TODO（现在不用管）

## AI 流协议

// TODO（现在不用管）

## 日志协议

日志协议用于 lb 向 mpe 传输运行时日志信息。

### CLI 日志输出

lb 在命令行中输出的日志格式：

```
[时间戳][级别][模块] 消息内容
```

示例：

```
[14:32:15][INFO][WebSocket] 客户端已连接: 127.0.0.1:52341
[14:32:16][INFO][File] 扫描到 12 个 pipeline 文件
[14:32:20][WARN][File] 文件已被外部修改: task.json
```

### 日志传输

lb 可选择将日志实时推送给 mpe：

**`/lte/log`** - 日志消息

```json
{
  "path": "/lte/log",
  "data": {
    "level": "INFO" | "WARN" | "ERROR",
    "module": "WebSocket" | "File" | "MaaFW" | ...,
    "message": "日志内容",
    "timestamp": "2026-01-01T14:32:15Z"
  }
}
```

mpe 可通过配置决定是否接收日志推送。
