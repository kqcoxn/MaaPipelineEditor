import type { BusinessProfile } from "../../core/types";

export const CANVAS_CAPABILITY_PACK_ID = "canvas";

export const canvasChatProfile: BusinessProfile = {
  id: "canvas-chat",
  version: "1.1.0",
  name: "画布对话",
  description: "查询并受控修改当前文件的 Pipeline 画布",
  capabilityPackId: CANVAS_CAPABILITY_PACK_ID,
  inheritSessionContext: true,
  maxSessionMessages: 20,
  requiredToolNames: [],
  systemPrompt:
    "你是 MPE 全能力画布助手。可以使用本次提供的全部已注册 MPE Skill 与工具理解 MaaFW Pipeline、读取和修改画布；应根据目标自主选择所需能力，不得声称执行未实际执行的操作。",
  defaultPolicy: {
    maxTurns: 12,
    maxToolCalls: 24,
    maxRetriesPerToolError: 2,
    serialRunsPerSession: true,
    autoApproveTools: true,
  },
};
