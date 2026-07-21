import { describe, expect, it } from "vitest";

import {
  PROJECT_TREE_ROOT_KEY,
  buildProjectTree,
  getSelectedProjectTreeKeys,
  preserveExpandedProjectTreeKeys,
  withCreateFileDraft,
} from "./projectTree";

describe("projectTree", () => {
  const entries = [
    { path: "zeta.txt", name: "zeta.txt", kind: "file" as const },
    { path: "src/z.json", name: "z.json", kind: "file" as const },
    { path: "src", name: "src", kind: "directory" as const },
    { path: "empty", name: "empty", kind: "directory" as const },
    { path: "src/A.json", name: "A.json", kind: "file" as const },
  ];

  it("builds directory-first, case-insensitive sorted trees", () => {
    const tree = buildProjectTree("C:/workspace", entries, ["src/A.json"]);

    expect(tree.key).toBe(PROJECT_TREE_ROOT_KEY);
    expect(tree.children?.map((node) => node.title)).toEqual([
      "empty",
      "src",
      "zeta.txt",
    ]);
    expect(tree.children?.[0].children).toEqual([]);
    expect(tree.children?.[1].children?.map((node) => node.title)).toEqual([
      "A.json",
      "z.json",
    ]);
  });

  it("only marks indexed pipeline files selectable", () => {
    const tree = buildProjectTree("C:/workspace", entries, ["src/A.json"]);
    const src = tree.children?.find((node) => node.title === "src");
    const selected = src?.children?.find((node) => node.title === "A.json");
    const other = src?.children?.find((node) => node.title === "z.json");

    expect(selected?.selectable).toBe(true);
    expect(other?.selectable).toBe(false);
    expect(getSelectedProjectTreeKeys("src/A.json", ["src/A.json"])).toEqual([
      "src/A.json",
    ]);
    expect(getSelectedProjectTreeKeys("src/z.json", ["src/A.json"])).toEqual(
      [],
    );
  });

  it("marks every file with a document capability selectable", () => {
    const tree = buildProjectTree("C:/workspace", entries, [
      {
        path: "zeta.txt",
        name: "zeta.txt",
        kind: "text",
        language: "plaintext",
        mimeType: "text/plain",
        size: 12,
        editable: true,
        previewable: true,
      },
    ]);
    const text = tree.children?.find((node) => node.path === "zeta.txt");

    expect(text?.selectable).toBe(true);
    expect(text?.document?.kind).toBe("text");
    expect(getSelectedProjectTreeKeys("zeta.txt", [text!.document!])).toEqual([
      "zeta.txt",
    ]);
  });

  it("keeps expanded directories that still exist", () => {
    const tree = buildProjectTree("C:/workspace", entries, []);
    expect(
      preserveExpandedProjectTreeKeys(
        [PROJECT_TREE_ROOT_KEY, "src", "removed"],
        tree,
      ),
    ).toEqual([PROJECT_TREE_ROOT_KEY, "src"]);
    expect(preserveExpandedProjectTreeKeys([], tree)).toEqual([]);
  });

  it("inserts a temporary create row under the target directory", () => {
    const tree = buildProjectTree("C:/workspace", entries, []);
    const rendered = withCreateFileDraft(tree, "src");
    const source = tree.children?.find((node) => node.path === "src");
    const target = rendered.children?.find((node) => node.path === "src");

    expect(source?.children?.some((node) => node.kind === "draft")).toBe(false);
    expect(target?.children?.[0]).toMatchObject({
      kind: "draft",
      path: "src",
      selectable: false,
    });
  });
});
