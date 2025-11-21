"""WebSocket 服务器核心逻辑"""

import asyncio
import json
import logging
from typing import Any, Optional
from datetime import datetime

import websockets

from .handlers import MessageHandler

logger = logging.getLogger(__name__)


class WebSocketTestServer:
    """WebSocket 测试服务器"""

    def __init__(self, host: str = "localhost", port: int = 9066, ui_callback=None):
        self.host = host
        self.port = port
        self.clients = set()
        self.ui_callback = ui_callback
        self.server = None
        self.pipelines = {}
        self.loop = None
        self.stop_event = None
        self.handler = MessageHandler(self)

    def log(self, message: str, level: str = "INFO"):
        """记录日志到控制台和UI"""
        if level == "INFO":
            logger.info(message)
        elif level == "WARNING":
            logger.warning(message)
        elif level == "ERROR":
            logger.error(message)

        if self.ui_callback:
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.ui_callback(f"[{timestamp}] {level} - {message}")

    def send_message(self, websocket, path: str, data: Any):
        """发送消息到客户端"""
        message = json.dumps({"path": path, "data": data})
        return websocket.send(message)

    async def handle_client(self, websocket):
        """处理客户端连接"""
        client_address = websocket.remote_address
        self.log(f"✓ 客户端已连接: {client_address}")
        self.clients.add(websocket)

        try:
            async for message in websocket:
                await self.handler.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            self.log(f"✗ 客户端已断开: {client_address}")
        except Exception as e:
            self.log(f"处理客户端时出错: {e}", "ERROR")
        finally:
            self.clients.discard(websocket)

    async def start(self):
        """启动服务器"""
        self.log(f"启动 WebSocket 服务器: ws://{self.host}:{self.port}")

        # 创建停止事件
        self.stop_event = asyncio.Event()

        self.server = await websockets.serve(self.handle_client, self.host, self.port)
        self.log("✓ 服务器已启动，等待客户端连接...")

        # 等待停止事件
        await self.stop_event.wait()

    async def stop(self):
        """停止服务器"""
        if self.server:
            # 设置停止事件
            if self.stop_event:
                self.stop_event.set()

            # 关闭服务器
            self.server.close()
            await self.server.wait_closed()
            self.log("服务器已停止")

    async def send_pipeline_to_client(self, file_path: str, pipeline: dict):
        """主动发送 Pipeline 到客户端"""
        if not self.clients:
            self.log("没有连接的客户端", "WARNING")
            return False

        try:
            # 发送到所有连接的客户端
            for client in self.clients:
                await self.send_message(
                    client,
                    "/cte/send_pipeline",
                    {"file_path": file_path, "pipeline": pipeline},
                )

            self.log(f"✓ 已发送 Pipeline 到 {len(self.clients)} 个客户端: {file_path}")
            return True
        except Exception as e:
            self.log(f"发送 Pipeline 失败: {e}", "ERROR")
            return False
