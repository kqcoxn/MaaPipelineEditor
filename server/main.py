"""MaaPipelineEditor WebSocket 测试服务器 - 主入口"""

import logging

from ui import ServerUI

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)


def main():
    """主函数"""
    ui = ServerUI()
    ui.run()


if __name__ == "__main__":
    main()
