import { describe, expect, it } from "vitest";
import {
  areFilePathsEqual,
  isFilePathWithinRoot,
  normalizeFilePath,
} from "./filePathUtils";

describe("file path comparison", () => {
  it("normalizes Windows separators and case", () => {
    expect(normalizeFilePath(" C:\\Project\\Pipeline\\main.json\\ ")).toBe(
      "c:/project/pipeline/main.json",
    );
    expect(areFilePathsEqual("C:\\Project\\main.json", "c:/project/main.json")).toBe(
      true,
    );
  });

  it("checks root boundaries instead of using a raw string prefix", () => {
    expect(
      isFilePathWithinRoot(
        "C:\\Projects\\demo\\pipeline\\main.json",
        "c:/projects/demo",
      ),
    ).toBe(true);
    expect(
      isFilePathWithinRoot(
        "C:\\Projects\\demo-old\\pipeline\\main.json",
        "c:/projects/demo",
      ),
    ).toBe(false);
  });

  it("handles drive roots", () => {
    expect(isFilePathWithinRoot("C:\\pipeline\\main.json", "C:\\")).toBe(
      true,
    );
  });
});
