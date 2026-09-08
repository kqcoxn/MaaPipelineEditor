import { describe, expect, it, vi } from "vitest";
import { createQuizAchievementTracker } from "./quizProgress";

function setup() {
  const award = vi.fn();
  const tracker = createQuizAchievementTracker(award);
  tracker.start();
  return { award, tracker };
}

describe("答题成就", () => {
  it("未开始答题也可以直接跳过获得入场券，重复领取不重复计数", () => {
    const award = vi.fn();
    const tracker = createQuizAchievementTracker(award);
    tracker.shortcut();
    tracker.receiveCertificate(true);
    tracker.receiveCertificate(true);
    expect(award.mock.calls.flat()).toEqual(["quiz_shortcut", "quiz_pass"]);
  });
  it("仅一键填写尚未通关时不授予入场券", () => {
    const { award, tracker } = setup();
    tracker.shortcut();
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_shortcut"]);
  });
  it("只错误一次后通过不解锁原来如此", () => {
    const { award, tracker } = setup();
    tracker.submit(false);
    tracker.submit(true);
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_failure", "quiz_pass"]);
  });
  it("首次全对并领取证书，重复领取不重复计数", () => {
    const { award, tracker } = setup();
    tracker.submit(true);
    expect(award).not.toHaveBeenCalled();
    tracker.receiveCertificate();
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_first", "quiz_pass"]);
  });
  it.each([2, 3])("错误 %i 次后通过可解锁原来如此", (count) => {
    const { award, tracker } = setup();
    for (let i = 0; i < count; i++) tracker.submit(false);
    tracker.submit(true);
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_failure", "quiz_retry", "quiz_pass"]);
  });
  it("第 4 次错误立即触发，第 5 次不重复，后续通过不解锁原来如此", () => {
    const { award, tracker } = setup();
    tracker.submit(false);
    expect(award.mock.calls.flat()).toEqual(["quiz_failure"]);
    for (let i = 0; i < 2; i++) tracker.submit(false);
    expect(award.mock.calls.flat()).toEqual(["quiz_failure"]);
    tracker.submit(false);
    expect(award.mock.calls.flat()).toEqual(["quiz_failure", "quiz_persistent"]);
    tracker.submit(false);
    tracker.submit(true);
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_failure", "quiz_persistent", "quiz_pass"]);
  });
  it("辅助填写后通关获得隐藏成就和入场券，新一轮可正常获得成就", () => {
    const { award, tracker } = setup();
    tracker.shortcut();
    for (let i = 0; i < 4; i++) tracker.submit(false);
    tracker.submit(true);
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_shortcut", "quiz_pass"]);
    tracker.start();
    tracker.submit(true);
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_shortcut", "quiz_pass", "quiz_first", "quiz_pass"]);
  });
  it("未提交通过时不能领取，重新打开会清空错误记录", () => {
    const { award, tracker } = setup();
    tracker.receiveCertificate();
    tracker.submit(false);
    tracker.start();
    tracker.submit(true);
    tracker.receiveCertificate();
    expect(award.mock.calls.flat()).toEqual(["quiz_failure", "quiz_first", "quiz_pass"]);
  });
});
