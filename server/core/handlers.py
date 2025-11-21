"""消息处理器模块"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class MessageHandler:
    """处理 WebSocket 消息的路由分发"""

    def __init__(self, server):
        self.server = server

    async def handle_send_pipeline(self, data: Any, websocket):
        """处理 /etc/send_pipeline 路由 - 接收客户端发送的 Pipeline"""
        try:
            file_path = data.get("file_path", "unknown")
            pipeline = data.get("pipeline")

            if not pipeline:
                self.server.log("接收到空的 Pipeline 数据", "WARNING")
                await self.server.send_message(
                    websocket,
                    "/error",
                    {"status": "error", "message": "Pipeline 数据为空"},
                )
                return

            # 检查本地文件是否存在
            if not os.path.exists(file_path):
                self.server.log(f"✗ 本地文件不存在: {file_path}", "ERROR")
                await self.server.send_message(
                    websocket,
                    "/error",
                    {
                        "status": "error",
                        "message": f"本地文件不存在: {file_path}",
                    },
                )
                return

            # 将 Pipeline 写入本地文件
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(pipeline, f, ensure_ascii=False, indent=2)
                self.server.log(
                    f"✓ 已保存 Pipeline 到本地文件: {file_path} (节点数: {len(pipeline)})"
                )
            except Exception as write_error:
                self.server.log(f"写入文件失败: {write_error}", "ERROR")
                await self.server.send_message(
                    websocket,
                    "/error",
                    {
                        "status": "error",
                        "message": f"写入文件失败: {str(write_error)}",
                    },
                )
                return

            # 存储 Pipeline 到内存
            self.server.pipelines[file_path] = pipeline

            # 发送确认消息
            await self.server.send_message(
                websocket,
                "/etc/send_pipeline/ack",
                {
                    "status": "ok",
                    "file_path": file_path,
                    "message": "Pipeline 已接收并保存",
                },
            )

        except Exception as e:
            self.server.log(f"处理 send_pipeline 时出错: {e}", "ERROR")

    async def handle_request_pipeline(self, data: Any, websocket):
        """处理 /api/request_pipeline 路由 - 客户端请求 Pipeline"""
        try:
            file_path = data.get("file_path")

            if not file_path:
                self.server.log("请求缺少 file_path 参数", "WARNING")
                return

            self.server.log(f"收到 Pipeline 请求: {file_path}")

            # 检查是否有该 Pipeline
            if file_path in self.server.pipelines:
                pipeline = self.server.pipelines[file_path]
                self.server.log(f"✓ 响应 Pipeline 请求: {file_path}")

                # 发送 Pipeline 数据
                await self.server.send_message(
                    websocket,
                    "/api/response_pipeline",
                    {"file_path": file_path, "pipeline": pipeline},
                )
            else:
                self.server.log(f"未找到请求的 Pipeline: {file_path}", "WARNING")
                await self.server.send_message(
                    websocket,
                    "/error",
                    {"status": "error", "message": f"未找到 Pipeline: {file_path}"},
                )

        except Exception as e:
            self.server.log(f"处理 request_pipeline 时出错: {e}", "ERROR")

    async def handle_message(self, websocket, message: str):
        """处理接收到的消息"""
        try:
            parsed = json.loads(message)
            path = parsed.get("path")
            data = parsed.get("data")

            self.server.log(f"← 收到消息 [{path}]")

            # 路由分发
            if path == "/etc/send_pipeline":
                await self.handle_send_pipeline(data, websocket)
            elif path == "/api/request_pipeline":
                await self.handle_request_pipeline(data, websocket)
            else:
                self.server.log(f"未找到路由处理器: {path}", "WARNING")
                await self.server.send_message(
                    websocket,
                    "/error",
                    {"status": "error", "message": f"未找到路由: {path}"},
                )

        except json.JSONDecodeError as e:
            self.server.log(f"JSON 解析错误: {e}", "ERROR")
            await self.server.send_message(
                websocket, "/error", {"status": "error", "message": "无效的 JSON 格式"}
            )
        except Exception as e:
            self.server.log(f"处理消息时出错: {e}", "ERROR")
