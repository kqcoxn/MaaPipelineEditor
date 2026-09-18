import { describe, expect, it } from "vitest";
import { displayPath } from "./path";

describe("displayPath", () => {
  it("shows Windows drive paths without the extended-length prefix", () => {
    expect(displayPath(String.raw`\\?\D:\_Projects\中文 项目`)).toBe(
      String.raw`D:\_Projects\中文 项目`,
    );
  });

  it("keeps UNC paths absolute when removing the prefix", () => {
    expect(displayPath(String.raw`\\?\UNC\server\share\project`)).toBe(
      String.raw`\\server\share\project`,
    );
  });

  it("preserves ordinary paths and other Windows namespaces", () => {
    for (const path of [
      String.raw`D:\Projects\demo`,
      String.raw`\\server\share\project`,
      String.raw`\\?\Volume{1234}\project`,
      String.raw`\\.\pipe\mpelb`,
      "/Users/name/Projects/demo",
      "",
    ]) {
      expect(displayPath(path)).toBe(path);
    }
  });
});
