import type { AchievementCategory, AchievementDef } from "./types";

export interface AchievementItem {
  key: string;
  def: AchievementDef;
  tiers: AchievementDef[];
  unlockedCount: number;
  complete: boolean;
  next?: AchievementDef;
}

/**保留定义顺序；系列展示已获得的最高档，同时独立保留下一目标。 */
export function buildAchievementItems(
  defs: AchievementDef[],
  unlocked: Record<string, { at: number }>,
): AchievementItem[] {
  const groups = new Map<string, AchievementDef[]>();
  for (const def of defs) {
    const key = def.series ?? def.id;
    const group = groups.get(key) ?? [];
    group.push(def);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => {
    const tiers = [...group].sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1));
    const achieved = tiers.filter((def) => unlocked[def.id]);
    return {
      key, tiers,
      def: achieved.at(-1) ?? tiers[0],
      unlockedCount: achieved.length,
      complete: achieved.length === tiers.length,
      next: tiers.find((def) => !unlocked[def.id]),
    };
  });
}

export function getAchievementProgress(
  def: AchievementDef,
  counters: Record<string, number>,
  progress: Record<string, number>,
  unlocked: boolean,
) {
  if (unlocked) return { percent: 100, label: "已解锁" };
  if (def.trigger.kind === "counter") {
    const current = Math.max(0, counters[def.trigger.counter] ?? 0);
    const target = def.trigger.target;
    return {
      percent: target <= 0 ? 100 : Math.min(100, current / target * 100),
      label: `${current} / ${target}`,
    };
  }
  const percent = Math.max(0, Math.min(100, (progress[def.id] ?? 0) * 100));
  return { percent, label: percent > 0 ? `${Math.floor(percent)}%` : "等待探索" };
}

/**仅描述主题关系，不参与引擎求值。key 使用系列 key 或单成就 id。 */
export const achievementConnections: [string, string][] = [
  ["terms_accepted", "quiz_first"],
  ["terms_accepted", "quiz_failure"], ["terms_accepted", "quiz_shortcut"],
  ["quiz_failure", "quiz_retry"], ["quiz_retry", "quiz_persistent"],
  ["quiz_first", "quiz_pass"],
  ["quiz_retry", "quiz_pass"], ["quiz_persistent", "quiz_pass"], ["quiz_shortcut", "quiz_pass"],
  ["quiz_pass", "canvas_first_node"],
  ["canvas_first_node", "canvas_rename"], ["canvas_rename", "field_added"],
  ["canvas_first_node", "node_created"], ["canvas_first_node", "nodes_pasted"],
  ["canvas_first_node", "canvas_recognition"], ["canvas_first_node", "canvas_action"],
  ["canvas_recognition", "canvas_variety"], ["canvas_action", "canvas_variety"],
  ["canvas_rename", "canvas_note"], ["field_added", "canvas_json"],
  ["nodes_pasted", "canvas_bulk_copy"],
  ["node_created", "node_deleted"],
  ["canvas_first_node", "canvas_first_edge"], ["canvas_first_edge", "connection_branch"],
  ["connection_branch", "connection_error"], ["canvas_first_edge", "connection_external"],
  ["canvas_first_edge", "edge_created"], ["canvas_first_edge", "connection_chain"],
  ["edge_created", "edge_deleted"], ["connection_branch", "connection_reorder"],
  ["connection_branch", "connection_many_paths"], ["connection_branch", "connection_merge"],
  ["connection_branch", "connection_cycle"], ["connection_error", "connection_error_chain"],
  ["canvas_first_edge", "debug_first_run"], ["debug_first_run", "pipeline_saved"],
  ["organize_layout", "explore_group_master"], ["explore_group_master", "template_saved"],
  ["organize_layout", "organize_align"], ["explore_group_master", "organize_group_color"],
  ["organize_layout", "organize_edge_control"],
  ["template_saved", "organize_reuse"],
  ["material_device", "screenshot_saved"],
  ["material_device", "tool_screenshot_captured"], ["material_device", "material_preview_collapsed"],
  ["roi_applied", "material_offset"], ["material_offset", "material_delta"], ["screenshot_saved", "roi_applied"],
  ["roi_applied", "ocr_recognized"], ["roi_applied", "material_color"],
  ["screenshot_saved", "material_uploaded"], ["material_color", "material_tolerance"],
  ["roi_applied", "debug_recognition"], ["debug_recognition", "debug_single"],
  ["debug_single", "debug_first_run"], ["debug_first_run", "debug_run"],
  ["debug_recognition", "debug_action"], ["debug_action", "debug_run"],
  ["debug_first_run", "debug_stop"], ["debug_details", "debug_image"],
  ["debug_retry", "explore_fix"],
  ["debug_first_run", "debug_details"], ["debug_details", "debug_retry"],
  ["project_import", "pipeline_saved"], ["pipeline_saved", "project_partial"],
  ["pipeline_saved", "project_separated"],
  ["project_import", "project_harness"],
];

export const categoryIntroductions: Record<AchievementCategory, string> = {
  onboarding: "从理解开始，为接下来的探索做好准备。",
  canvas: "从一个节点开始，把想法写进字段。",
  connection: "串起步骤，也为分支和意外留好路。",
  organize: "整理画布，把好用的做法留下来。",
  material: "连接现场，准备图像、文字与颜色。",
  debug: "让流程跑起来，循着结果验证每一步。",
  project: "接续已有项目，保存自己的成果。",
  ai: "与 AI 一起，把想法变成流程。",
  explore: "开发中的小经历，也值得收藏。",
};
