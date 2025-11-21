"""服务器 UI 界面"""

import asyncio
import json
import logging
import os
import sys
import threading
import tkinter as tk
from datetime import datetime
from tkinter import filedialog, messagebox, scrolledtext
from typing import Optional

try:
    from PIL import Image, ImageTk

    HAS_PIL = True
except ImportError:
    HAS_PIL = False

import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from core import WebSocketTestServer

logger = logging.getLogger(__name__)


class ServerUI:
    """服务器 UI 界面"""

    def __init__(self):
        # 使用 ttkbootstrap 主题
        self.root = ttk.Window(themename="flatly")
        self.root.title("MaaPipelineEditor WebSocket Server for Test")
        self.root.geometry("1000x750")

        # 设置窗口背景色
        self.root.configure(bg="#ecf0f1")

        self.server: Optional[WebSocketTestServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.is_running = False

        self.setup_ui()

        # 在UI设置后再设置图标
        self.set_window_icon()

        # 开启时自动启动服务器
        self.root.after(100, self.auto_start_server)

    def set_window_icon(self):
        """设置窗口图标"""
        icon_path = self.get_icon_path()
        logger.info(f"图标路径: {icon_path}")
        logger.info(
            f"图标文件存在: {os.path.exists(icon_path) if icon_path else False}"
        )

        if icon_path and os.path.exists(icon_path):
            try:
                if HAS_PIL:
                    # 使用 PIL 加载 PNG 图标
                    img = Image.open(icon_path)
                    # 调整图标大小为多个尺寸，提高兼容性
                    sizes = [16, 32, 48, 64, 128, 256]
                    photos = []
                    for size in sizes:
                        resized = img.resize((size, size), Image.Resampling.LANCZOS)
                        photo = ImageTk.PhotoImage(resized)
                        photos.append(photo)

                    # 设置多个尺寸的图标
                    self.root.iconphoto(True, *photos)
                    # 保持引用防止被垃圾回收
                    self.root._icon_photos = photos
                    logger.info("✓ 已使用 PIL 加载多尺寸图标")
                else:
                    # 降级使用 tkinter 原生支持
                    photo = tk.PhotoImage(file=icon_path)
                    self.root.iconphoto(True, photo)
                    self.root._icon_photo = photo
                    logger.info("✓ 已使用 tkinter 加载图标")
            except Exception as e:
                logger.warning(f"无法加载图标: {e}")
                import traceback

                logger.warning(traceback.format_exc())
        else:
            logger.warning("图标文件不存在或路径为空")

    def get_icon_path(self) -> Optional[str]:
        """获取图标路径"""
        if getattr(sys, "frozen", False):
            # PyInstaller 打包后
            base_path = sys._MEIPASS
            return os.path.join(base_path, "assets", "maafw.png")
        else:
            # 开发环境
            base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            return os.path.join(base_path, "public", "maafw.png")

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
            try:
                # 在服务器的事件循环中执行停止操作
                future = asyncio.run_coroutine_threadsafe(self.server.stop(), self.loop)
                # 等待停止完成（缩短超时时间）
                future.result(timeout=1)
            except (asyncio.TimeoutError, Exception):
                pass  # 静默处理异常

        # 清理引用
        self.server = None
        self.loop = None
        self.server_thread = None

        self.is_running = False
        self.status_var.set("● 已停止")
        self.status_label.config(bootstyle="danger")
        self.start_btn.config(state=NORMAL)
        self.stop_btn.config(state=DISABLED)
        self.log_message("[系统] 服务器已完全停止")

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
