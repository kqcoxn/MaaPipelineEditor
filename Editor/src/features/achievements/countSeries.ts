import type { AchievementCategory, AchievementDef } from "./types";

interface CountSeriesOptions {
  id: string;
  category: AchievementCategory;
  counter: string;
  series?: string;
  title: string;
  subtitle: string;
  action: string;
  targets: readonly number[];
  unit?: string;
}

/**生成统一标题、副标题的累计成就；首档使用基础 ID，后续档追加阈值。 */
export function countSeries({
  id, category, counter, series = counter, title, subtitle, action, targets, unit = "次",
}: CountSeriesOptions): AchievementDef[] {
  return targets.map((target, index) => ({
    id: index === 0 ? id : `${id}_${target}`,
    title: `${title} ${["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"][index] ?? index + 1}`,
    subtitle,
    description: `累计${action} ${target} ${unit}`,
    category,
    series,
    tier: index + 1,
    trigger: { kind: "counter", counter, target },
  }));
}
