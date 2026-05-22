import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "local-files",
  title: "本地文件管理",
  summary: "本地文件列表不是普通标签页，而是通过 LocalBridge 访问真实工作目录的入口。",
  searchText:
    "本地文件管理 本地文件 文件列表 LocalBridge 工作目录 打开文件 刷新文件列表 保存 新建 自动同步",
  steps: [
    {
      id: "open-real-files",
      title: "本地文件列表面向真实目录",
      summary: "它解决的是工作区文件访问，不是当前标签页切换。",
      keywords: ["本地文件", "工作目录", "真实文件", "筛选"],
      searchText:
        "本地文件 工作目录 真实文件 标签页切换 LocalBridge 文件列表 json jsonc 目录结构 筛选",
      blocks: [
        {
          type: "paragraph",
          text: "标签页只是在当前已打开的文件之间切换；本地文件列表则是通过 LocalBridge 进入真实工作目录，显示所有 .json 和 .jsonc 文件的目录结构，支持搜索筛选。点击文件即可加载到编辑器中。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "启动目录",
          text: "请在 Pipeline 文件所在目录启动 LocalBridge，不要在过高层级启动（如 C:\\ 或 ~），否则文件列表会包含大量无关文件。",
        },
      ],
    },
    {
      id: "file-operations",
      title: "打开、保存和新建文件",
      summary: "文件列表支持打开、覆盖保存和新建操作。",
      keywords: ["打开文件", "保存文件", "新建文件"],
      searchText:
        "打开文件 保存文件 新建文件 覆盖保存 文件名 目录选择 特殊字符",
      blocks: [
        {
          type: "markdown",
          text: "- **打开**：点击文件列表中的文件，加载到编辑器标签页\n- **保存**：覆盖写回原文件（不可逆，请确认后操作）\n- **新建**：通过 Pipeline 面板新建，需指定文件名和目录",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "文件名限制",
          text: "文件名不能包含特殊字符：\\ / : * ? \" < > |。分离模式的配置文件以 . 开头，默认隐藏。",
        },
      ],
    },
    {
      id: "refresh-and-sync",
      title: "刷新与自动同步",
      summary: "文件列表支持手动刷新和自动同步本地变更。",
      keywords: ["刷新文件列表", "自动同步", "手动刷新"],
      searchText:
        "刷新文件列表 自动同步 手动刷新 找不到文件 目录过滤 文件变更 自动重载",
      blocks: [
        {
          type: "paragraph",
          text: "如果看不到预期文件，先检查根目录和目录过滤，再点击刷新按钮重新扫描目录。开启自动同步后，本地文件变更会自动反映到列表中，已打开的文件也会提示重载。",
        },
        {
          type: "paragraph",
          text: "手动刷新适合在外部工具修改文件后快速同步状态。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
