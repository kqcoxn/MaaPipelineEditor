import type { AchievementDef } from "../types";
import { onboardingAchievements } from "./onboarding";
import { canvasAchievements } from "./canvas";
import { connectionAchievements } from "./connection";
import { organizeAchievements } from "./organize";
import { materialAchievements } from "./material";
import { debugAchievements } from "./debug";
import { projectAchievements } from "./project";
import { aiAchievements } from "./ai";
import { exploreAchievements } from "./explore";

export const achievementDefs: AchievementDef[] = [
  ...onboardingAchievements,
  ...canvasAchievements,
  ...connectionAchievements,
  ...organizeAchievements,
  ...materialAchievements,
  ...debugAchievements,
  ...projectAchievements,
  ...aiAchievements,
  ...exploreAchievements,
];

export { counterRules } from "./counters";
