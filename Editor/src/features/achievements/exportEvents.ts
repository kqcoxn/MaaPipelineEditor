import { emitAchievementEvent } from "./bus";

/**使用实际导出的内容，避免等待保存时切换文件导致误判。 */
export function recordPipelineExport(content: unknown, kind?: "partial" | "separated"): void {
  let pipeline = content;
  if (typeof pipeline === "string") {
    try { pipeline = JSON.parse(pipeline); } catch { return; }
  }
  if (!pipeline || typeof pipeline !== "object" || Array.isArray(pipeline)) return;
  if (Object.entries(pipeline).some(([key, value]) => !key.startsWith("$__mpe_") &&
    value !== null && typeof value === "object" && !Array.isArray(value),
  )) {
    emitAchievementEvent("achievement:pipeline_saved");
    if (kind) emitAchievementEvent(`achievement:pipeline_${kind}_exported`);
  }
}
