import { describe, expect, it } from "vitest";
import { shouldShowLocalToolbarActions } from "./toolbarVisibility";

describe("shouldShowLocalToolbarActions", () => {
  it("hides local toolbar actions for the MSE host", () => {
    expect(shouldShowLocalToolbarActions({ id: "mse", name: "MSE" })).toBe(
      false,
    );
  });

  it("keeps local toolbar actions for standalone and other hosts", () => {
    expect(shouldShowLocalToolbarActions(null)).toBe(true);
    expect(
      shouldShowLocalToolbarActions({ id: "test-host", name: "Test Host" }),
    ).toBe(true);
  });
});
