import { beforeEach, describe, expect, it } from "vitest";
import { resolveStarReminderTargets } from "./useEmbedStarReminder";

const targets = [
  {
    id: "mpe" as const,
    name: "MaaPipelineEditor",
    repositoryUrl: "https://github.com/kqcoxn/MaaPipelineEditor",
  },
  {
    id: "mse" as const,
    name: "Maa Pipeline Support",
    repositoryUrl: "https://github.com/neko-para/maa-support-extension",
  },
];

describe("resolveStarReminderTargets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows both repository links when only MSE is pending", () => {
    localStorage.setItem("mpe_stared", "true");

    expect(resolveStarReminderTargets(targets)?.map((target) => target.id)).toEqual(
      ["mpe", "mse"],
    );
  });

  it("does not show a reminder after both projects are handled", () => {
    localStorage.setItem("mpe_stared", "true");
    localStorage.setItem("_mse_stared", "true");

    expect(resolveStarReminderTargets(targets)).toBeNull();
  });
});
