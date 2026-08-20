import { MFW_PIPELINE_SKILL_ID } from "../../skills/mfw-pipeline/definition";
import type {
  CapabilityPack,
  HarnessModule,
  HarnessSkill,
} from "../../core/types";
import {
  SEMANTIC_LAYOUT_CAPABILITY_PACK_ID,
  semanticLayoutProfile,
} from "./profile";
import {
  semanticLayoutToolDefinitions,
  semanticLayoutToolHandlers,
} from "./tools";

const SEMANTIC_LAYOUT_SKILL_ID = "semantic-layout-planning";

const semanticLayoutSkill: HarnessSkill = {
  id: SEMANTIC_LAYOUT_SKILL_ID,
  version: "3.0.0",
  name: "MPE 语义布局规划",
  description: "将 MaaFW 执行结构规划为通用语义块、阅读泳道与相对关系",
  instructions:
    "先读取语义上下文，再把执行主干、候选分支、JumpBack 子链和错误链划分为互斥阅读泳道；保持连续语义段完整，由本地算法切块、折行和评分；只提交宏观意图，不生成坐标或修改业务结构。",
};

const semanticLayoutCapabilityPack: CapabilityPack = {
  id: SEMANTIC_LAYOUT_CAPABILITY_PACK_ID,
  version: "3.0.0",
  description: "只读 MaaFW 画布语义并提交受控布局意图",
  skillIds: [MFW_PIPELINE_SKILL_ID, SEMANTIC_LAYOUT_SKILL_ID],
  toolNames: semanticLayoutToolDefinitions.map((tool) => tool.name),
};

export const semanticLayoutHarnessModule: HarnessModule = {
  skills: [semanticLayoutSkill],
  tools: semanticLayoutToolDefinitions,
  profiles: [semanticLayoutProfile],
  capabilityPacks: [semanticLayoutCapabilityPack],
  toolHandlers: semanticLayoutToolHandlers,
};
