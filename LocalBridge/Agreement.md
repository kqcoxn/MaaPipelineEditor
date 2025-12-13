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

## MaaFramework 协议

MaaFramework 协议（简称 MFW 协议）用于支持 MaaMpeGoDebugger 调试器与参数传输，提供 MaaFramework 底层能力的 WebSocket 接口封装。该协议基于 maa-framework-go API 实现，支持设备连接、控制器管理、截图传输等核心功能。

### 功能概述

MFW 协议主要提供以下能力：

1. **设备列表维护**

   - ADB 设备列表的发现与维护
   - Win32 窗体列表的发现与维护
   - 设备状态实时同步

2. **连接参数传输**

   - ADB 连接参数配置（路径、地址、截图/输入方法等）
   - Win32 连接参数配置（窗口句柄、截图/输入方法等）
   - 自定义控制器参数传输

3. **截图与图像传输**

   - 实时截图获取
   - 图像数据编码与传输
   - 缓存图像的复用机制

4. **控制器操作**

   - 点击、滑动、输入等基础操作
   - 应用启动/停止控制
   - 触摸与按键事件模拟

5. **任务执行与调试**
   - 任务提交与状态查询
   - 任务详情获取
   - 执行日志与事件回调

### 设备发现与管理

#### ADB 设备列表

**`/lte/mfw/adb_devices`** - 推送 ADB 设备列表

```json
{
  "path": "/lte/mfw/adb_devices",
  "data": {
    "devices": [
      {
        "adb_path": "/path/to/adb",
        "address": "127.0.0.1:5555",
        "name": "device_name",
        "screencap_methods": [
          "EncodeToFileAndPull",
          "Encode",
          "RawWithGzip",
          "RawByNetcat",
          "MinicapDirect",
          "MinicapStream",
          "EmulatorExtras"
        ],
        "input_methods": [
          "AdbShell",
          "MinitouchAndAdbKey",
          "Maatouch",
          "EmulatorExtras"
        ],
        "config": "{}"
      }
    ]
  }
}
```

**`/etl/mfw/refresh_adb_devices`** - 请求刷新 ADB 设备列表

```json
{
  "path": "/etl/mfw/refresh_adb_devices",
  "data": {}
}
```

#### Win32 窗体列表

**`/lte/mfw/win32_windows`** - 推送 Win32 窗体列表

```json
{
  "path": "/lte/mfw/win32_windows",
  "data": {
    "windows": [
      {
        "hwnd": "0x12345678",
        "class_name": "WindowClass",
        "window_name": "Window Title",
        "screencap_methods": [
          "GDI",
          "FramePool",
          "DXGIDesktopDup",
          "DXGIDesktopDupWindow",
          "PrintWindow",
          "ScreenDC"
        ],
        "input_methods": [
          "Seize",
          "SendMessage",
          "PostMessage",
          "LegacyEvent",
          "PostThreadMessage"
        ]
      }
    ]
  }
}
```

**`/etl/mfw/refresh_win32_windows`** - 请求刷新 Win32 窗体列表

```json
{
  "path": "/etl/mfw/refresh_win32_windows",
  "data": {}
}
```

### 控制器连接管理

#### 创建 ADB 控制器

**`/etl/mfw/create_adb_controller`** - 创建并连接 ADB 控制器

```json
{
  "path": "/etl/mfw/create_adb_controller",
  "data": {
    "adb_path": "/path/to/adb",
    "address": "127.0.0.1:5555",
    "screencap_method": ["Encode", "RawByNetcat"],
    "input_method": ["Maatouch", "AdbShell"],
    "config": "{}",
    "agent_path": "/path/to/MaaAgentBinary"
  }
}
```

**`/lte/mfw/controller_created`** - 控制器创建结果

```json
{
  "path": "/lte/mfw/controller_created",
  "data": {
    "success": true,
    "controller_id": "ctrl_uuid_123",
    "uuid": "device_uuid",
    "error": null
  }
}
```

#### 创建 Win32 控制器

**`/etl/mfw/create_win32_controller`** - 创建并连接 Win32 控制器

```json
{
  "path": "/etl/mfw/create_win32_controller",
  "data": {
    "hwnd": "0x12345678",
    "screencap_method": "DXGI_DesktopDup",
    "input_method": "Seize"
  }
}
```

#### 控制器连接状态

**`/lte/mfw/controller_status`** - 推送控制器状态

```json
{
  "path": "/lte/mfw/controller_status",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "connected": true,
    "uuid": "device_uuid"
  }
}
```

**`/etl/mfw/disconnect_controller`** - 断开控制器连接

```json
{
  "path": "/etl/mfw/disconnect_controller",
  "data": {
    "controller_id": "ctrl_uuid_123"
  }
}
```

### 截图与图像传输

#### 请求截图

**`/etl/mfw/request_screencap`** - 请求设备截图

```json
{
  "path": "/etl/mfw/request_screencap",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "use_cache": false,
    "target_long_side": 1280,
    "target_short_side": 720,
    "use_raw_size": false
  }
}
```

**`/lte/mfw/screencap_result`** - 返回截图数据

```json
{
  "path": "/lte/mfw/screencap_result",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "success": true,
    "image_data": "base64_encoded_png_data",
    "width": 1920,
    "height": 1080,
    "timestamp": "2025-12-09T19:23:09Z",
    "error": null
  }
}
```

### 控制器操作

#### 点击操作

**`/etl/mfw/controller_click`** - 发送点击指令

```json
{
  "path": "/etl/mfw/controller_click",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "x": 100,
    "y": 200
  }
}
```

#### 滑动操作

**`/etl/mfw/controller_swipe`** - 发送滑动指令

```json
{
  "path": "/etl/mfw/controller_swipe",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "x1": 100,
    "y1": 200,
    "x2": 300,
    "y2": 400,
    "duration": 500
  }
}
```

#### 输入文本

**`/etl/mfw/controller_input_text`** - 发送文本输入指令

```json
{
  "path": "/etl/mfw/controller_input_text",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "text": "Hello World"
  }
}
```

#### 应用控制

**`/etl/mfw/controller_start_app`** - 启动应用

```json
{
  "path": "/etl/mfw/controller_start_app",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "intent": "com.example.app/.MainActivity"
  }
}
```

**`/etl/mfw/controller_stop_app`** - 停止应用

```json
{
  "path": "/etl/mfw/controller_stop_app",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "intent": "com.example.app"
  }
}
```

#### 操作结果通知

**`/lte/mfw/controller_operation_result`** - 控制器操作结果

```json
{
  "path": "/lte/mfw/controller_operation_result",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "operation": "click" | "swipe" | "input_text" | "start_app" | "stop_app",
    "job_id": 123456,
    "success": true,
    "status": "Success" | "Failure" | "Pending" | "Running",
    "error": null
  }
}
```

### 任务管理

#### 任务提交

**`/etl/mfw/submit_task`** - 提交 MaaFramework 任务

```json
{
  "path": "/etl/mfw/submit_task",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "resource_path": "/path/to/resource",
    "entry": "Startup",
    "override": {
      /* 可选的覆盖参数 */
    }
  }
}
```

**`/lte/mfw/task_submitted`** - 任务提交结果

```json
{
  "path": "/lte/mfw/task_submitted",
  "data": {
    "success": true,
    "task_id": 789012,
    "error": null
  }
}
```

#### 任务状态查询

**`/etl/mfw/query_task_status`** - 查询任务状态

```json
{
  "path": "/etl/mfw/query_task_status",
  "data": {
    "task_id": 789012
  }
}
```

**`/lte/mfw/task_status`** - 任务状态更新

```json
{
  "path": "/lte/mfw/task_status",
  "data": {
    "task_id": 789012,
    "status": "Success" | "Failure" | "Pending" | "Running",
    "detail": {
      /* 任务详情对象，包含执行信息 */
    }
  }
}
```

#### 任务停止

**`/etl/mfw/stop_task`** - 停止正在执行的任务

```json
{
  "path": "/etl/mfw/stop_task",
  "data": {
    "task_id": 789012
  }
}
```

### 事件回调

#### 控制器事件

**`/lte/mfw/controller_event`** - 控制器事件通知

```json
{
  "path": "/lte/mfw/controller_event",
  "data": {
    "controller_id": "ctrl_uuid_123",
    "event_type": "ResourceLoading" | "ControllerAction" | "TaskerTask" | "NodeRecognition" | "NodeAction",
    "message": "事件消息内容",
    "detail": {
      /* 事件详细数据 */
    },
    "timestamp": "2025-12-09T19:23:09Z"
  }
}
```

#### 任务执行事件

**`/lte/mfw/task_event`** - 任务执行事件通知

```json
{
  "path": "/lte/mfw/task_event",
  "data": {
    "task_id": 789012,
    "event_type": "TaskNextList" | "TaskRecognition" | "TaskAction" | "NodePipelineNode",
    "message": "事件消息内容",
    "detail": {
      /* 事件详细数据 */
    },
    "timestamp": "2025-12-09T19:23:09Z"
  }
}
```

### 资源管理

#### 资源加载

**`/etl/mfw/load_resource`** - 加载资源包

```json
{
  "path": "/etl/mfw/load_resource",
  "data": {
    "resource_path": "/path/to/resource"
  }
}
```

**`/lte/mfw/resource_loaded`** - 资源加载结果

```json
{
  "path": "/lte/mfw/resource_loaded",
  "data": {
    "success": true,
    "resource_id": "res_uuid_456",
    "hash": "resource_hash_value",
    "error": null
  }
}
```

#### 自定义识别/动作注册

**`/etl/mfw/register_custom_recognition`** - 注册自定义识别

```json
{
  "path": "/etl/mfw/register_custom_recognition",
  "data": {
    "resource_id": "res_uuid_456",
    "name": "MyCustomRecognition"
  }
}
```

**`/etl/mfw/register_custom_action`** - 注册自定义动作

```json
{
  "path": "/etl/mfw/register_custom_action",
  "data": {
    "resource_id": "res_uuid_456",
    "name": "MyCustomAction"
  }
}
```

### 错误处理

MFW 协议相关错误使用统一的错误消息格式：

```json
{
  "path": "/error",
  "data": {
    "code": "MFW_ERROR_CODE",
    "message": "错误描述",
    "detail": {
      "controller_id": "ctrl_uuid_123",
      "operation": "create_controller"
    }
  }
}
```

MFW 错误码：

| 错误码                       | 说明                  |
| ---------------------------- | --------------------- |
| `MFW_CONTROLLER_CREATE_FAIL` | 控制器创建失败        |
| `MFW_CONTROLLER_NOT_FOUND`   | 控制器不存在          |
| `MFW_CONNECTION_FAILED`      | 设备连接失败          |
| `MFW_SCREENCAP_FAILED`       | 截图失败              |
| `MFW_OPERATION_FAILED`       | 控制器操作失败        |
| `MFW_TASK_SUBMIT_FAILED`     | 任务提交失败          |
| `MFW_RESOURCE_LOAD_FAILED`   | 资源加载失败          |
| `MFW_INVALID_PARAMETER`      | 参数无效              |
| `MFW_DEVICE_NOT_FOUND`       | 未找到可用设备        |
| `MFW_NOT_INITIALIZED`        | MaaFramework 未初始化 |

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
