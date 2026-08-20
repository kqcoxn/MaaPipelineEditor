import { MFW_PIPELINE_SKILL_ID } from "../../skills/mfw-pipeline/definition";
import type {
  CapabilityPack,
  HarnessModule,
  HarnessSkill,
} from "../../core/types";
import {
  BUSINESS_ARCHITECTURE_CAPABILITY_PACK_ID,
  businessArchitectureProfile,
} from "./profile";
import {
  businessArchitectureToolDefinitions,
  businessArchitectureToolHandlers,
} from "./tools";

const BUSINESS_ARCHITECTURE_SKILL_ID = "business-architecture-analysis";

const businessArchitectureSkill: HarnessSkill = {
  id: BUSINESS_ARCHITECTURE_SKILL_ID,
  version: "1.0.0",
  name: "MPE 业务流程梳理",
  description: "从 MaaFW 执行图提炼业务阶段并生成只读架构视图",
  instructions:
    "先读取确定性执行结构，再根据节点业务线索将全部节点归入少量互斥阶段；保留候选顺序、错误恢复、JumpBack 与循环的真实含义，只提交阶段分组，不修改画布或自行创建阶段关系。",
};

const businessArchitectureCapabilityPack: CapabilityPack = {
  id: BUSINESS_ARCHITECTURE_CAPABILITY_PACK_ID,
  version: "1.0.0",
  description: "只读 MaaFW 画布并生成经本地校验的业务语义架构",
  skillIds: [MFW_PIPELINE_SKILL_ID, BUSINESS_ARCHITECTURE_SKILL_ID],
  toolNames: businessArchitectureToolDefinitions.map((tool) => tool.name),
};

export const businessArchitectureHarnessModule: HarnessModule = {
  skills: [businessArchitectureSkill],
  tools: businessArchitectureToolDefinitions,
  profiles: [businessArchitectureProfile],
  capabilityPacks: [businessArchitectureCapabilityPack],
  toolHandlers: businessArchitectureToolHandlers,
};
