import { describe, expect, it } from "vitest";

import {
  joinProjectPath,
  parseProjectPath,
  remapProjectPath,
} from "./projectPath";

describe("ProjectPath", () => {
  it.each([
    "",
    "/pipeline/main.json",
    "C:/pipeline/main.json",
    "\\\\server\\share\\main.json",
    "pipeline\\main.json",
    "pipeline//main.json",
    "pipeline/./main.json",
    "pipeline/../main.json",
  ])("rejects non-canonical protocol path %j", (value) => {
    expect(() => parseProjectPath(value)).toThrow();
  });

  it("joins a validated entry name below a project directory", () => {
    expect(joinProjectPath("pipeline/nested", "main.jsonc")).toBe(
      "pipeline/nested/main.jsonc",
    );
    expect(() => joinProjectPath("pipeline", "../main.json")).toThrow();
  });

  it("remaps only the renamed directory boundary", () => {
    expect(
      remapProjectPath("pipeline/main.json", "pipeline", "flows", true),
    ).toBe("flows/main.json");
    expect(
      remapProjectPath("pipeline-old/main.json", "pipeline", "flows", true),
    ).toBe("pipeline-old/main.json");
  });
});
