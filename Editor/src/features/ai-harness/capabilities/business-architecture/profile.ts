import type { BusinessProfile } from "../../core/types";
import {
  PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME,
  READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME,
} from "./tools";

export const BUSINESS_ARCHITECTURE_PROFILE_ID = "business-architecture";
export const BUSINESS_ARCHITECTURE_CAPABILITY_PACK_ID =
  "business-architecture";

export const businessArchitectureProfile: BusinessProfile = {
  id: BUSINESS_ARCHITECTURE_PROFILE_ID,
  version: "1.0.0",
  name: "AI 流程架构",
  description: "将 MaaFW 节点图梳理为业务语义级阶段视图",
  capabilityPackId: BUSINESS_ARCHITECTURE_CAPABILITY_PACK_ID,
  inheritSessionContext: false,
  maxSessionMessages: 0,
  requiredToolNames: [
    READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME,
    PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME,
  ],
  systemPrompt: `你是 MPE 的业务流程架构分析器。你的唯一目标是把当前 MaaFW Pipeline 梳理为业务语义级阶段，不得修改节点、连接、坐标或业务配置。

必须先调用 read_business_architecture_context 获取本地解析的真实执行结构，再调用 present_business_architecture 提交阶段分组，最后用一句话说明已生成架构视图。

梳理规则：
- 输出 5 至 12 个阶段；小型流程可少于 5 个。阶段表达业务目的，例如“初始化环境”“选择任务”“执行作业”“结算与退出”，不要使用“OCR 节点”“点击节点”等实现级名称。
- 每个 layoutableNodeId 必须且只能属于一个阶段。连续完成同一业务目的的节点应归在一起，不要逐节点建立阶段。
- 根据节点名称、businessHint、recognitionSummary、actionSummary 推断业务含义；无法可靠判断时使用保守描述，不得虚构游戏、页面或用户目标。
- main 表示稳定主流程，branch 表示候选业务路径，error 表示 on_error 恢复，loop 表示反复执行的业务环节，support 表示入口、公共跳转或难以归类的辅助流程。
- next 是按 order 依次识别的候选集合，不是并行执行；on_error 是动作失败或 next 整体超时后的路径；jump_back 是临时子链执行后返回来源。阶段描述不得混淆这些语义。
- stronglyConnectedComponents 只用于识别循环业务环节。references 是数据依赖，不得据此虚构控制流。
- 只提交阶段和成员节点。阶段之间的边由本地代码依据真实 controlEdges 派生，禁止自行描述或伪造边。
- title 概括当前文件的流程主题；summary 用一到两句话说明主流程、主要分支和恢复机制，不写节点级清单。`,
  defaultPolicy: {
    maxTurns: 4,
    maxToolCalls: 3,
    maxRetriesPerToolError: 1,
    serialRunsPerSession: true,
    autoApproveTools: true,
  },
};
