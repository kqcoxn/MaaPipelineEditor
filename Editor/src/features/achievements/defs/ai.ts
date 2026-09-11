import type { AchievementDef } from "../types";
import { countSeries } from "../countSeries";

export const aiAchievements: AchievementDef[] = [
  ...countSeries({
    id: "ai_programmer",
    category: "ai",
    counter: "ai_edit_completed",
    title: "天才程序员",
    subtitle: "我们两个真厉害！",
    action: "通过 AI 成功完成有效画布编辑任务",
    targets: [1, 5, 20, 50, 200],
  }),
  {
    id: "ai_architecture",
    title: "恍然大悟",
    subtitle: "原来我写的是这个。",
    description: "首次成功生成业务架构视图",
    category: "ai",
    trigger: { kind: "counter", counter: "ai_architecture_presented", target: 1 },
  },
  {
    id: "ai_layout",
    title: "天女散花",
    subtitle: "这就是 AI 的排版水平",
    description: "首次通过 AI 语义布局实际改变节点位置",
    category: "ai",
    trigger: { kind: "counter", counter: "ai_layout_applied", target: 1 },
  },
  {
    id: "ai_compact",
    title: "/compact",
    subtitle: "脑子满了，先整理一下。",
    description: "首次成功手动压缩 AI 对话上下文",
    category: "ai",
    hidden: true,
    trigger: { kind: "counter", counter: "ai_context_compacted", target: 1 },
  }
];
