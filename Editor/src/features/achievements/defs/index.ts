import type { AchievementDef } from "../types";
import { canvasAchievements } from "./canvas";
import { debugAchievements } from "./debug";
import { exploreAchievements } from "./explore";

/**全部成就定义（按分类文件汇总） */
export const achievementDefs: AchievementDef[] = [
  ...canvasAchievements,
  ...debugAchievements,
  ...exploreAchievements,
];

export { counterRules } from "./counters";
