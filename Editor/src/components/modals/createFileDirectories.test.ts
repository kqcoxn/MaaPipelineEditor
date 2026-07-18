import { describe, expect, it } from "vitest";

import {
  formatPipelineDirectory,
  getInitialPipelineDirectory,
  normalizePipelineDirectories,
} from "./createFileDirectories";

describe("Pipeline create directories", () => {
  const directories = [
    "project/resource/pipeline/nested",
    "project/resource/pipeline",
    "project/resource/pipeline",
  ];

  it("uses only backend-provided Pipeline directories", () => {
    expect(normalizePipelineDirectories(directories)).toEqual([
      "project/resource/pipeline",
      "project/resource/pipeline/nested",
    ]);
  });

  it("uses the current file directory only when it is allowed", () => {
    const normalized = normalizePipelineDirectories(directories);

    expect(
      getInitialPipelineDirectory(
        normalized,
        "project/resource/pipeline/nested/main.json",
      ),
    ).toBe("project/resource/pipeline/nested");
    expect(
      getInitialPipelineDirectory(normalized, "project/resource/default_pipeline.json"),
    ).toBe("project/resource/pipeline");
  });

  it("displays the complete root-relative path", () => {
    expect(formatPipelineDirectory("project/resource/pipeline/nested")).toBe(
      "project/resource/pipeline/nested",
    );
  });
});
