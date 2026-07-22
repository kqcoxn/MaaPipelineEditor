import { describe, expect, it } from "vitest";

import { createPipelineSourceExports } from "./pipelineSourceExport";

describe("createPipelineSourceExports", () => {
  it("keeps Pipeline and sidecar source byte-for-byte in browser export files", () => {
    const pipelineText =
      '\uFEFF// comment\r\n{\r\n  "Start": { "unknown": true },\r\n}\r\n';
    const configText = '// sidecar\n{"file_config":{"filename":"main"}}\n';

    expect(
      createPipelineSourceExports({
        baseName: "main",
        format: "jsonc",
        target: "both",
        pipelineText,
        configText,
      }),
    ).toEqual([
      { name: "main.jsonc", text: pipelineText, format: "jsonc" },
      { name: "main.mpe.json", text: configText, format: "json" },
    ]);
  });
});
