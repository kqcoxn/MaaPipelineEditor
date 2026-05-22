import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "why-localbridge",
  title: "何时需要 LocalBridge",
  summary: "LocalBridge 是本地能力入口，只有在你需要文件、截图或调试时才必须接入。",
  searchText:
    "何时需要 LocalBridge 本地能力 文件管理 截图工具 调试 设备连接 在线版 安装 启动 连接 端口 mpelb",
  steps: [
    {
      id: "recognize-boundary",
      title: "先区分纯编辑和本地能力",
      summary: "不是所有使用场景都必须先装 LocalBridge。",
      keywords: ["纯编辑", "本地能力", "在线版"],
      searchText:
        "纯编辑 本地能力 在线版 LocalBridge 是否必须 文件管理 调试 字段辅助 AI辅助",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只做 Pipeline 编辑、结构梳理或临时导入导出，在线版就够用了；只有当你要接触本地文件、截图工具、设备控制或流程调试时，LocalBridge 才成为必须前置。",
        },
        {
          type: "markdown",
          text: "LocalBridge 提供四大能力：\n- **文件管理**：访问本地工作目录\n- **字段辅助**：OCR、截图、ROI 等快捷工具\n- **流程调试**：运行 Pipeline 并查看结果\n- **AI 辅助**：智能节点配置预测",
        },
      ],
    },
    {
      id: "install-and-start",
      title: "安装与启动",
      summary: "一条命令安装，mpelb 启动即可。",
      keywords: ["安装", "启动", "mpelb", "端口"],
      searchText:
        "安装 启动 mpelb 端口 9066 PowerShell bash npm go install 一键安装",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "# Windows (PowerShell)\nirm https://mpe.codax.site/install.ps1 | iex\n\n# Linux / macOS\ncurl -fsSL https://mpe.codax.site/install.sh | bash",
        },
        {
          type: "paragraph",
          text: "安装完成后，在 Pipeline 文件所在目录运行 mpelb 即可启动，默认监听 9066 端口。可通过 --port 指定其他端口，--root 指定工作目录。",
        },
      ],
    },
    {
      id: "connect-editor",
      title: "连接 Editor",
      summary: "在编辑器中点击连接按钮，输入地址即可。",
      keywords: ["连接", "自动连接", "端口配置", "断开"],
      searchText:
        "连接 Editor 自动连接 端口配置 断开 连接状态 地址 localhost",
      blocks: [
        {
          type: "paragraph",
          text: "编辑器左下角显示连接状态。点击后输入 LocalBridge 地址（默认 localhost:9066）即可连接。开启自动连接后，下次打开编辑器会自动尝试重连。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "启动目录很重要",
          text: "请在 Pipeline 文件所在目录（或其父目录）启动 mpelb，不要在过高层级（如 C:\\ 或 ~）启动，否则文件列表会包含大量无关文件。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
