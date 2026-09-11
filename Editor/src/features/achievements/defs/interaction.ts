import type { AchievementDef } from "../types";

export const interactionAchievements: AchievementDef[] = [
  {
    id: "interaction_export_logs",
    title: "有据可查",
    subtitle: "你要的全拿走",
    description: "首次成功导出日志包",
    category: "daily",
    trigger: { kind: "counter", counter: "logs_exported", target: 1 },
  },
  {
    id: "daily_style",
    title: "换个心情",
    subtitle: "皮肤不加属性，但加心情。",
    description: "首次手动切换节点风格",
    category: "daily",
    trigger: { kind: "counter", counter: "node_style_changed", target: 1 },
  },
  {
    id: "daily_dark",
    title: "天黑请闭眼",
    subtitle: "谁把我灯关了！",
    description: "首次手动切换到深色模式",
    category: "daily",
    trigger: { kind: "counter", counter: "dark_mode_enabled", target: 1 },
  },
  {
    id: "daily_panel",
    title: "我的地盘",
    subtitle: "这里的规矩，我来定。",
    description: "首次手动修改字段／连接面板模式",
    category: "daily",
    trigger: { kind: "counter", counter: "panel_mode_changed", target: 1 },
  },
  {
    id: "daily_log",
    title: "查查记录",
    subtitle: "互联网是有记忆的。",
    description: "首次通过操作日志成功定位到仍存在的节点",
    category: "daily",
    trigger: { kind: "counter", counter: "operation_log_located", target: 1 },
  },
];
