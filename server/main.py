import asyncio
import json
import logging
import threading
from tkinter import filedialog, messagebox, scrolledtext
from typing import Any, Optional
from datetime import datetime
import os

import ttkbootstrap as ttk
from ttkbootstrap.constants import *
import websockets

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)
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

    async def handle_send_pipeline(self, data: Any, websocket):
        """处理 /api/send_pipeline 路由 - 接收客户端发送的 Pipeline"""
        try:
            file_path = data.get("file_path", "unknown")
            pipeline = data.get("pipeline")

            if not pipeline:
                self.log("接收到空的 Pipeline 数据", "WARNING")
                await self.send_message(
                    websocket,
                    "/error",
                    {"status": "error", "message": "Pipeline 数据为空"},
                )
                return

            # 存储 Pipeline
            self.pipelines[file_path] = pipeline
            self.log(f"✓ 已接收 Pipeline: {file_path} (节点数: {len(pipeline)})")

            # 发送确认消息
            await self.send_message(
                websocket,
                "/api/send_pipeline/ack",
                {"status": "ok", "file_path": file_path, "message": "Pipeline 已接收"},
            )

        except Exception as e:
            self.log(f"处理 send_pipeline 时出错: {e}", "ERROR")

    async def handle_request_pipeline(self, data: Any, websocket):
        """处理 /api/request_pipeline 路由 - 客户端请求 Pipeline"""
        try:
            file_path = data.get("file_path")

            if not file_path:
                self.log("请求缺少 file_path 参数", "WARNING")
                return

            self.log(f"收到 Pipeline 请求: {file_path}")

            # 检查是否有该 Pipeline
            if file_path in self.pipelines:
                pipeline = self.pipelines[file_path]
                self.log(f"✓ 响应 Pipeline 请求: {file_path}")

                # 发送 Pipeline 数据
                await self.send_message(
                    websocket,
                    "/api/response_pipeline",
                    {"file_path": file_path, "pipeline": pipeline},
                )
            else:
                self.log(f"未找到请求的 Pipeline: {file_path}", "WARNING")
                await self.send_message(
                    websocket,
                    "/error",
                    {"status": "error", "message": f"未找到 Pipeline: {file_path}"},
                )

        except Exception as e:
            self.log(f"处理 request_pipeline 时出错: {e}", "ERROR")

    async def handle_message(self, websocket, message: str):
        """处理接收到的消息"""
        try:
            parsed = json.loads(message)
            path = parsed.get("path")
            data = parsed.get("data")

            self.log(f"← 收到消息 [{path}]")

            # 路由分发
            if path == "/api/send_pipeline":
                await self.handle_send_pipeline(data, websocket)
            elif path == "/api/request_pipeline":
                await self.handle_request_pipeline(data, websocket)
            else:
                self.log(f"未找到路由处理器: {path}", "WARNING")
                await self.send_message(
                    websocket,
                    "/error",
                    {"status": "error", "message": f"未找到路由: {path}"},
                )

        except json.JSONDecodeError as e:
            self.log(f"JSON 解析错误: {e}", "ERROR")
            await self.send_message(
                websocket, "/error", {"status": "error", "message": "无效的 JSON 格式"}
            )
        except Exception as e:
            self.log(f"处理消息时出错: {e}", "ERROR")

    async def handle_client(self, websocket):
        """处理客户端连接"""
        client_address = websocket.remote_address
        self.log(f"✓ 客户端已连接: {client_address}")
        self.clients.add(websocket)

        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            self.log(f"✗ 客户端已断开: {client_address}")
        except Exception as e:
            self.log(f"处理客户端时出错: {e}", "ERROR")
        finally:
            self.clients.discard(websocket)

    async def start(self):
        """启动服务器"""
        self.log(f"启动 WebSocket 服务器: ws://{self.host}:{self.port}")

        self.server = await websockets.serve(self.handle_client, self.host, self.port)
        self.log("✓ 服务器已启动，等待客户端连接...")
        await asyncio.Future()

    async def stop(self):
        """停止服务器"""
        if self.server:
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
                    "/api/import_pipeline",
                    {"file_path": file_path, "pipeline": pipeline},
                )

            self.log(f"✓ 已发送 Pipeline 到 {len(self.clients)} 个客户端: {file_path}")
            return True
        except Exception as e:
            self.log(f"发送 Pipeline 失败: {e}", "ERROR")
            return False


class ServerUI:
    """服务器 UI 界面"""

    def __init__(self):
        # 使用 ttkbootstrap 主题
        self.root = ttk.Window(themename="flatly")
        self.root.title("Pipeline WebSocket 服务器")
        self.root.geometry("1000x750")

        # 设置窗口背景色
        self.root.configure(bg="#ecf0f1")

        self.server: Optional[WebSocketTestServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.is_running = False

        self.setup_ui()

        # 开启时自动启动服务器
        self.root.after(100, self.auto_start_server)

    def setup_ui(self):
        """设置 UI 界面"""
        # 主容器
        main_container = ttk.Frame(self.root, padding=20)
        main_container.pack(fill=BOTH, expand=YES)

        # 顶部控制面板 - 使用圆角卡片
        control_card = ttk.Labelframe(
            main_container, text="⚙️  服务器控制", bootstyle="primary", padding=20
        )
        control_card.pack(fill=X, pady=(0, 20))

        # 配置网格布局
        config_frame = ttk.Frame(control_card)
        config_frame.pack(fill=X, pady=(0, 15))

        # 端口配置
        ttk.Label(config_frame, text="端口:", font=("Microsoft YaHei UI", 10)).grid(
            row=0, column=0, sticky=W, padx=(0, 8)
        )

        self.port_var = ttk.StringVar(value="9066")
        port_entry = ttk.Entry(
            config_frame,
            textvariable=self.port_var,
            width=10,
            font=("Microsoft YaHei UI", 10),
        )
        port_entry.grid(row=0, column=1, sticky=W, padx=(0, 30))

        # 状态指示
        ttk.Label(config_frame, text="状态:", font=("Microsoft YaHei UI", 10)).grid(
            row=0, column=2, sticky=W, padx=(0, 8)
        )

        self.status_var = ttk.StringVar(value="● 已停止")
        self.status_label = ttk.Label(
            config_frame,
            textvariable=self.status_var,
            font=("Microsoft YaHei UI", 10, "bold"),
            bootstyle="danger",
        )
        self.status_label.grid(row=0, column=3, sticky=W)

        # 控制按钮
        button_frame = ttk.Frame(control_card)
        button_frame.pack(fill=X)

        self.start_btn = ttk.Button(
            button_frame,
            text="▶  启动服务器",
            command=self.start_server,
            bootstyle="success",
            width=18,
        )
        self.start_btn.pack(side=LEFT, padx=(0, 10))

        self.stop_btn = ttk.Button(
            button_frame,
            text="⏹  停止服务器",
            command=self.stop_server,
            state=DISABLED,
            bootstyle="danger",
            width=18,
        )
        self.stop_btn.pack(side=LEFT)

        # Pipeline 管理面板
        pipeline_card = ttk.Labelframe(
            main_container, text="📦  Pipeline 管理", bootstyle="info", padding=20
        )
        pipeline_card.pack(fill=BOTH, expand=YES, pady=(0, 20))

        # Pipeline 列表
        list_frame = ttk.Frame(pipeline_card)
        list_frame.pack(fill=BOTH, expand=YES, pady=(0, 15))

        # 创建 Treeview - 添加文件名列
        columns = ("文件名", "文件路径", "节点数", "接收时间")
        self.pipeline_tree = ttk.Treeview(
            list_frame, columns=columns, show="headings", height=7
        )
        self.pipeline_tree.heading("文件名", text="📄 文件名")
        self.pipeline_tree.heading("文件路径", text="📂 文件路径")
        self.pipeline_tree.heading("节点数", text="🔢 节点数")
        self.pipeline_tree.heading("接收时间", text="⏰ 接收时间")
        self.pipeline_tree.column("文件名", width=150)
        self.pipeline_tree.column("文件路径", width=350)
        self.pipeline_tree.column("节点数", width=100)
        self.pipeline_tree.column("接收时间", width=150)

        # 滚动条
        scrollbar = ttk.Scrollbar(
            list_frame, orient=VERTICAL, command=self.pipeline_tree.yview
        )
        self.pipeline_tree.configure(yscrollcommand=scrollbar.set)

        self.pipeline_tree.pack(side=LEFT, fill=BOTH, expand=YES)
        scrollbar.pack(side=RIGHT, fill=Y)

        # Pipeline 操作按钮
        pipeline_btn_frame = ttk.Frame(pipeline_card)
        pipeline_btn_frame.pack(fill=X)

        ttk.Button(
            pipeline_btn_frame,
            text="📁  从文件加载",
            command=self.load_pipeline_from_file,
            bootstyle="primary",
        ).pack(side=LEFT, padx=(0, 8))
        ttk.Button(
            pipeline_btn_frame,
            text="📤  发送到客户端",
            command=self.send_selected_pipeline,
            bootstyle="info",
        ).pack(side=LEFT, padx=(0, 8))
        ttk.Button(
            pipeline_btn_frame,
            text="👁  查看详情",
            command=self.view_pipeline_detail,
            bootstyle="secondary",
        ).pack(side=LEFT, padx=(0, 8))
        ttk.Button(
            pipeline_btn_frame,
            text="🗑  删除",
            command=self.delete_selected_pipeline,
            bootstyle="warning",
        ).pack(side=LEFT, padx=(0, 8))
        ttk.Button(
            pipeline_btn_frame,
            text="🧹  清空全部",
            command=self.clear_all_pipelines,
            bootstyle="danger",
        ).pack(side=LEFT)

        # 日志面板
        log_card = ttk.Labelframe(
            main_container, text="📋  服务器日志", bootstyle="success", padding=20
        )
        log_card.pack(fill=BOTH, expand=YES)

        # 日志文本框
        log_text_frame = ttk.Frame(log_card)
        log_text_frame.pack(fill=BOTH, expand=YES, pady=(0, 15))

        self.log_text = scrolledtext.ScrolledText(
            log_text_frame, height=8, state=DISABLED, font=("Consolas", 9), wrap="word"
        )
        self.log_text.pack(fill=BOTH, expand=YES)

        # 配置日志标签颜色
        self.log_text.tag_config("INFO", foreground="#3498db")
        self.log_text.tag_config("WARNING", foreground="#f39c12")
        self.log_text.tag_config("ERROR", foreground="#e74c3c")
        self.log_text.tag_config("SUCCESS", foreground="#27ae60")

        # 日志控制按钮
        log_btn_frame = ttk.Frame(log_card)
        log_btn_frame.pack(fill=X)

        ttk.Button(
            log_btn_frame,
            text="🧹  清空日志",
            command=self.clear_log,
            bootstyle="secondary-outline",
        ).pack(side=LEFT)

    def log_message(self, message: str):
        """添加日志消息"""

        def append_log():
            self.log_text.config(state=NORMAL)

            # 根据日志级别添加不同颜色
            if "INFO" in message:
                tag = "INFO"
            elif "WARNING" in message or "警告" in message:
                tag = "WARNING"
            elif "ERROR" in message or "错误" in message:
                tag = "ERROR"
            elif "✓" in message or "成功" in message:
                tag = "SUCCESS"
            else:
                tag = None

            if tag:
                self.log_text.insert("end", message + "\n", tag)
            else:
                self.log_text.insert("end", message + "\n")

            self.log_text.see("end")
            self.log_text.config(state=DISABLED)

        self.root.after(0, append_log)

    def auto_start_server(self):
        """自动启动服务器"""
        self.start_server()

    def start_server(self):
        """启动服务器"""
        try:
            port = int(self.port_var.get())
        except ValueError:
            messagebox.showerror("错误", "端口必须是数字")
            return

        if self.is_running:
            messagebox.showwarning("警告", "服务器已在运行中")
            return

        # 在新线程中启动服务器
        self.server_thread = threading.Thread(
            target=self._run_server, args=(port,), daemon=True
        )
        self.server_thread.start()

        self.is_running = True
        self.status_var.set("● 运行中")
        self.status_label.config(bootstyle="success")
        self.start_btn.config(state=DISABLED)
        self.stop_btn.config(state=NORMAL)
        self.log_message("[系统] 正在启动服务器...")

    def _run_server(self, port: int):
        """在独立线程中运行服务器"""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        self.server = WebSocketTestServer(
            host="localhost", port=port, ui_callback=self.log_message
        )
        self.server.loop = self.loop

        try:
            self.loop.run_until_complete(self.server.start())
        except Exception as e:
            self.log_message(f"[错误] 服务器异常: {e}")
            self.is_running = False

    def stop_server(self):
        """停止服务器"""
        if not self.is_running:
            return

        self.log_message("[系统] 正在停止服务器...")

        if self.loop and self.server:
            # 在服务器的事件循环中执行停止操作
            asyncio.run_coroutine_threadsafe(self.server.stop(), self.loop)
            self.loop.call_soon_threadsafe(self.loop.stop)

        self.is_running = False
        self.status_var.set("● 已停止")
        self.status_label.config(bootstyle="danger")
        self.start_btn.config(state=NORMAL)
        self.stop_btn.config(state=DISABLED)

    def load_pipeline_from_file(self):
        """从文件加载 Pipeline"""
        file_path = filedialog.askopenfilename(
            title="选择 Pipeline 文件",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")],
        )

        if not file_path:
            return

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                pipeline = json.load(f)

            # 添加到服务器的 pipelines 存储
            if self.server:
                self.server.pipelines[file_path] = pipeline
                self.add_pipeline_to_tree(file_path, pipeline)
                self.log_message(
                    f"[系统] 已加载 Pipeline: {os.path.basename(file_path)}"
                )
            else:
                messagebox.showwarning("警告", "服务器未运行")
        except Exception as e:
            messagebox.showerror("错误", f"加载文件失败: {e}")

    def add_pipeline_to_tree(self, file_path: str, pipeline: dict):
        """添加 Pipeline 到列表"""
        # 提取文件名
        file_name = os.path.basename(file_path)

        # 检查是否已存在
        for item in self.pipeline_tree.get_children():
            if self.pipeline_tree.item(item)["values"][1] == file_path:
                # 更新现有项
                self.pipeline_tree.item(
                    item,
                    values=(
                        file_name,
                        file_path,
                        len(pipeline),
                        datetime.now().strftime("%H:%M:%S"),
                    ),
                )
                return

        # 添加新项
        self.pipeline_tree.insert(
            "",
            "end",
            values=(
                file_name,
                file_path,
                len(pipeline),
                datetime.now().strftime("%H:%M:%S"),
            ),
        )

    def send_selected_pipeline(self):
        """发送选中的 Pipeline 到客户端"""
        selection = self.pipeline_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请选择要发送的 Pipeline")
            return

        if not self.is_running or not self.server:
            messagebox.showwarning("警告", "服务器未运行")
            return

        item = selection[0]
        file_path = self.pipeline_tree.item(item)["values"][1]

        if file_path in self.server.pipelines:
            pipeline = self.server.pipelines[file_path]
            # 在服务器的事件循环中发送
            asyncio.run_coroutine_threadsafe(
                self.server.send_pipeline_to_client(file_path, pipeline), self.loop
            )
        else:
            messagebox.showerror("错误", "Pipeline 数据不存在")

    def view_pipeline_detail(self):
        """查看 Pipeline 详情"""
        selection = self.pipeline_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请选择要查看的 Pipeline")
            return

        if not self.server:
            messagebox.showwarning("警告", "服务器未初始化")
            return

        item = selection[0]
        file_path = self.pipeline_tree.item(item)["values"][1]

        if file_path in self.server.pipelines:
            pipeline = self.server.pipelines[file_path]

            # 创建详情窗口
            detail_window = ttk.Toplevel(self.root)
            detail_window.title(f"📄 Pipeline 详情 - {os.path.basename(file_path)}")
            detail_window.geometry("800x600")

            text_widget = scrolledtext.ScrolledText(
                detail_window, wrap="word", font=("Consolas", 10)
            )
            text_widget.pack(fill=BOTH, expand=YES, padx=15, pady=15)

            # 格式化显示 JSON
            json_str = json.dumps(pipeline, indent=2, ensure_ascii=False)
            text_widget.insert("1.0", json_str)
            text_widget.config(state=DISABLED)
        else:
            messagebox.showerror("错误", "Pipeline 数据不存在")

    def delete_selected_pipeline(self):
        """删除选中的 Pipeline"""
        selection = self.pipeline_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请选择要删除的 Pipeline")
            return

        if not messagebox.askyesno("确认", "确定要删除选中的 Pipeline 吗?"):
            return

        item = selection[0]
        file_path = self.pipeline_tree.item(item)["values"][1]

        if self.server and file_path in self.server.pipelines:
            del self.server.pipelines[file_path]

        self.pipeline_tree.delete(item)
        self.log_message(f"[系统] 已删除 Pipeline: {os.path.basename(file_path)}")

    def clear_all_pipelines(self):
        """清空所有 Pipeline"""
        if not messagebox.askyesno("确认", "确定要清空所有 Pipeline 吗?"):
            return

        if self.server:
            self.server.pipelines.clear()

        for item in self.pipeline_tree.get_children():
            self.pipeline_tree.delete(item)

        self.log_message("[系统] 已清空所有 Pipeline")

    def clear_log(self):
        """清空日志"""
        self.log_text.config(state=NORMAL)
        self.log_text.delete(1.0, "end")
        self.log_text.config(state=DISABLED)

    def run(self):
        """运行 UI"""
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.mainloop()

    def on_closing(self):
        """关闭窗口时的处理"""
        if self.is_running:
            if messagebox.askyesno("确认", "服务器正在运行，确定要退出吗?"):
                self.stop_server()
                self.root.after(500, self.root.destroy)
        else:
            self.root.destroy()


def main():
    """主函数"""
    ui = ServerUI()
    ui.run()


if __name__ == "__main__":
    main()
