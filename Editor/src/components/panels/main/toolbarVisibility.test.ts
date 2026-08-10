import { describe, expect, it } from "vitest";
import { shouldShowLocalToolbarActions } from "./toolbarVisibility";

describe("shouldShowLocalToolbarActions", () => {
  it("hides local toolbar actions in every embed host", () => {
    expect(shouldShowLocalToolbarActions(true)).toBe(false);
  });

  it("keeps local toolbar actions in standalone mode", () => {
    expect(shouldShowLocalToolbarActions(false)).toBe(true);
  });
});
