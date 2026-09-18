import { describe, it, expect } from "vitest";
import { newer } from "./model";
describe("stable version comparison", () => {
  it("does not downgrade or reinstall the same version", () => {
    expect(newer("1.9.9", "1.10.1")).toBe(false);
    expect(newer("1.10.1", "1.10.1")).toBe(false);
  });
  it("compares numeric parts", () => {
    expect(newer("1.11.0", "1.9.9")).toBe(true);
    expect(newer("2.0.0", "1.99.99")).toBe(true);
  });
});
