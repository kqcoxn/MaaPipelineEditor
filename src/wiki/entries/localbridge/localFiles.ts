import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "local-files",
  title: "本地文件管理",
  summary: "本地文件列表不是普通标签页，而是通过 LocalBridge 访问真实工作目录的入口。",
  searchText:
    "本地文件管理 本地文件 文件列表 LocalBridge 工作目录 打开文件 刷新文件列表",
  steps: [
    {
      id: "open-real-files",
      title: "本地文件列表面向真实目录",
      summary: "它解决的是工作区文件访问，不是当前标签页切换。",
      keywords: ["本地文件", "工作目录", "真实文件"],
      searchText:
        "本地文件 工作目录 真实文件 标签页切换 LocalBridge 文件列表",
      blocks: [
        {
          type: "paragraph",
          text: "标签页只是在当前已打开的文件之间切换；本地文件列表则是通过 LocalBridge 进入真实工作目录，刷新、筛选并打开尚未载入的文件。不要把它理解成“另一个标签页视图”。",
        },
      ],
    },
    {
      id: "refresh-before-open",
      title: "目录不对或文件缺失时先刷新",
      summary: "很多“找不到文件”其实是列表还没刷新到最新状态。",
      keywords: ["刷新文件列表", "找不到文件", "目录过滤"],
      searchText:
        "刷新文件列表 找不到文件 目录过滤 relative path LocalBridge",
      blocks: [
        {
          type: "paragraph",
          text: "如果你已经连接了 LocalBridge，但看不到预期文件，先检查根目录和目录过滤，再尝试刷新文件列表。很多时候问题不是文件不存在，而是当前列表状态还没更新。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
