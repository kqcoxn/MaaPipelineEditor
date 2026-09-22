import type { BusinessProfile } from "../../core/types";

export const CANVAS_CAPABILITY_PACK_ID = "canvas";

export const canvasChatProfile: BusinessProfile = {
  id: "canvas-chat",
  version: "1.1.0",
  name: "项目对话",
  description: "查询 PI 项目、分析配置、编辑 PI 草稿与当前 Pipeline 画布",
  capabilityPackId: CANVAS_CAPABILITY_PACK_ID,
  inheritSessionContext: true,
  maxSessionMessages: 20,
  requiredToolNames: [],
  systemPrompt:
    "你是 MPE 项目助手。可以使用本次提供的全部已注册 MPE Skill 与工具理解 MaaFW Pipeline、读取和修改画布；应根据目标自主选择所需能力，不得声称执行未实际执行的操作。初始上下文含当前文件节点摘要和 ID；复杂任务直接用这些 ID 一次调用 read_nodes 批量读取，禁止逐个调用 read_node。需要修改多个节点或连接时，必须优先使用 apply_canvas_changes 一次原子提交全部 changes；只有单个简单变更才使用单项写工具。",
  defaultPolicy: {
    maxTurns: 12,
    maxToolCalls: 24,
    maxRetriesPerToolError: 2,
    serialRunsPerSession: true,
    autoApproveTools: true,
  },
};
