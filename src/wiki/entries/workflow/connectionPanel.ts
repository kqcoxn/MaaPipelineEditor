import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "connection-panel",
  title: "连接面板与连接操作",
  summary: "连接面板负责理解连接类型、顺序和 JumpBack 等关键关系。",
  searchText:
    "连接面板 连接操作 next on_error jumpback 顺序 调整连接 连接类型",
  steps: [
    {
      id: "choose-connection-type",
      title: "先区分连接类型",
      summary: "连接语义来自端点类型，而不是线条长相。",
      keywords: ["next", "on_error", "jumpback"],
      searchText:
        "连接类型 next on_error jumpback target anchor 连接语义",
      blocks: [
        {
          type: "paragraph",
          text: "连接的关键不在于线怎么画，而在于连接的是哪种端点。next、on_error 和 jumpback 会直接影响最终 Pipeline 语义，因此排查问题时先确认类型，再看布局。",
        },
      ],
    },
    {
      id: "adjust-order",
      title: "用连接面板调整顺序",
      summary: "顺序编号会影响同类连接被编译后的数组位置。",
      keywords: ["顺序", "连接编号", "编译顺序"],
      searchText:
        "连接顺序 编号 编译顺序 输入框 next jumpback on_error 连接面板",
      blocks: [
        {
          type: "paragraph",
          text: "当同一节点有多条同类型连接时，顺序编号会影响它们被编译到数组中的位置。遇到分支顺序不符合预期时，优先在连接面板里调顺序，而不是删除重连整条边。",
        },
      ],
    },
    {
      id: "validate-safety",
      title: "遇到拒绝连接时先看安全规则",
      summary: "重复目标、JumpBack 语义冲突等情况会被直接拦下。",
      keywords: ["拒绝连接", "重复目标", "安全规则"],
      searchText:
        "拒绝连接 重复目标 JumpBack 安全规则 on_error next 同时指向",
      blocks: [
        {
          type: "paragraph",
          text: "如果 MPE 拒绝了某条连接，不一定是编辑器坏了，更多时候是协议安全规则在生效，例如重复目标、next 与 jumpback 冲突，或 on_error 与其他关系不合法。",
        },
        {
          type: "markdown",
          text: "长文说明见：[连接](https://mpe.codax.site/docs/guide/core/link.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
