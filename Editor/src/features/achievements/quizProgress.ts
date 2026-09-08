import { emitAchievementEvent } from "./bus";

/**每次打开测试开始新一轮；返回介绍页不会清除本轮提交记录。 */
export function createQuizAchievementTracker(award: (key: string) => void) {
  let active = false;
  let failures = 0;
  let certificateReceived = false;
  let assisted = false;
  let passed = false;
  return {
    start() {
      active = true;
      failures = 0;
      certificateReceived = false;
      assisted = false;
      passed = false;
    },
    shortcut() {
      assisted = true;
      award("quiz_shortcut");
    },
    submit(correct: boolean) {
      if (!active || passed) return;
      if (correct) {
        passed = true;
      } else if (!assisted) {
        failures += 1;
        if (failures === 1) award("quiz_failure");
        if (failures === 4) award("quiz_persistent");
      }
    },
    receiveCertificate(skipped = false) {
      if (certificateReceived || (!skipped && (!active || !passed))) return;
      certificateReceived = true;
      active = false;
      if (!assisted && !skipped && failures === 0) award("quiz_first");
      if (!assisted && !skipped && failures >= 2 && failures <= 3) award("quiz_retry");
      award("quiz_pass");
    },
  };
}

export const quizAchievementTracker = createQuizAchievementTracker((key) => {
  emitAchievementEvent(`achievement:${key}`);
});
