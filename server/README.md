# Pipeline WebSocket 服务器

这是一个带有 Tkinter GUI 的 WebSocket 测试服务器，用于测试前端 WebSocket 客户端的连接和 Pipeline 数据通信。

## 功能特性

- ✅ 可视化服务器控制界面
- ✅ 实时连接状态显示
- ✅ Pipeline 数据管理
- ✅ 支持发送/接收 Pipeline JSON
- ✅ 实时日志输出
- ✅ 客户端连接数监控

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 启动服务器

```bash
python test_server.py
```

### 操作步骤

1. **启动服务器**

   - 在界面中设置端口（默认 9066）
   - 点击「启动服务器」按钮
   - 等待状态显示为「运行中」

2. **连接客户端**

   - 在前端应用中连接到 `ws://localhost:9066`
   - 服务器会显示客户端连接数

3. **管理 Pipeline**

   - **接收 Pipeline**: 当客户端发送 Pipeline 时，会自动显示在列表中
   - **加载 Pipeline**: 点击「从文件加载 Pipeline」可以加载本地 JSON 文件
   - **发送 Pipeline**: 选中列表中的项，点击「发送到客户端」
   - **查看详情**: 选中项后点击「查看详情」可查看完整的 Pipeline JSON
   - **删除/清空**: 可以删除单个或清空全部 Pipeline

4. **查看日志**
   - 底部日志面板会显示所有操作和消息
   - 可点击「清空日志」清除历史记录

## API 路由

### 服务器接收的路由

#### `/api/send_pipeline`

接收客户端发送的 Pipeline JSON

**请求数据格式**:

```json
{
  "file_path": "path/to/pipeline.json",
  "pipeline": {
    "task1": { ... },
    "task2": { ... }
  }
}
```

**响应**: 自动发送确认消息到 `/api/send_pipeline/ack`

#### `/api/request_pipeline`

接收客户端请求特定 Pipeline 的请求

**请求数据格式**:

```json
{
  "file_path": "path/to/pipeline.json"
}
```

**响应**: 如果找到对应 Pipeline，通过 `/api/response_pipeline` 返回

### 服务器发送的路由

#### `/api/import_pipeline`

主动发送 Pipeline 给客户端导入

**数据格式**:

```json
{
  "file_path": "path/to/pipeline.json",
  "pipeline": {
    "task1": { ... },
    "task2": { ... }
  }
}
```

#### `/api/response_pipeline`

回应客户端的 Pipeline 请求

**数据格式**:

```json
{
  "file_path": "path/to/pipeline.json",
  "pipeline": {
    "task1": { ... },
    "task2": { ... }
  }
}
```

## 消息格式

所有 WebSocket 消息使用以下 JSON 格式:

```json
{
  "path": "/api/route_name",
  "data": {
    // 具体数据内容
  }
}
```

## 开发说明

- 服务器使用异步 WebSocket（websockets 库）
- UI 使用 Tkinter 标准库
- 服务器运行在独立线程中，避免阻塞 UI
- 所有 Pipeline 数据存储在内存中

## 故障排除

**端口被占用**:

```bash
# Windows
netstat -ano | findstr :9066
taskkill /PID <PID> /F
```

**连接超时**:

- 检查防火墙设置
- 确认端口号匹配
- 查看服务器日志输出

## 日志输出

服务器会在 UI 界面输出以下日志：

- 客户端连接/断开
- 收到的消息路径和数据
- 发送的响应消息
- Pipeline 操作记录

## 注意事项

- Pipeline 数据仅存储在内存中，服务器重启后会丢失
- 建议先加载测试 Pipeline JSON 文件进行测试
- 支持多个客户端同时连接
- 发送 Pipeline 时会广播到所有连接的客户端
