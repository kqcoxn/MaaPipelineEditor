import { describe, expect, it } from "vitest";

import { analyzePipelineSource } from "./pipelineSourceAnalysis";

describe("analyzePipelineSource", () => {
  it("parses BOM, comments, CRLF and trailing commas without changing source offsets", () => {
    const source =
      '\uFEFF// header\r\n{\r\n  "$schema": "future",\r\n  "Start": {\r\n    "recognition": { "type": "DirectHit", "param": { "future": 1 } },\r\n    "extension": true,\r\n  },\r\n}\r\n';

    const analysis = analyzePipelineSource(source);

    expect(analysis.syntaxValid).toBe(true);
    expect(Object.keys(analysis.value ?? {})).toEqual(["$schema", "Start"]);
    expect(analysis.sourceMap?.locations.map((location) => location.path)).toEqual(
      expect.arrayContaining([
        [],
        ["$schema"],
        ["Start"],
        ["Start", "recognition", "param", "future"],
        ["Start", "extension"],
      ]),
    );
    const start = analysis.sourceMap?.locations.find(
      (location) => location.path.join(".") === "Start",
    );
    expect(source.slice(start!.key!.offset, start!.key!.offset + start!.key!.length)).toBe(
      '"Start"',
    );
    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["$schema"],
          supportLevel: "preserved",
        }),
        expect.objectContaining({
          path: ["Start", "recognition", "param", "future"],
          supportLevel: "preserved",
        }),
        expect.objectContaining({
          path: ["Start", "extension"],
          supportLevel: "preserved",
        }),
      ]),
    );
  });

  it("reports duplicate keys and invalid NodeAttr at their exact ranges", () => {
    const source =
      '{"Start":{"next":[{"name":"End","anchor":"yes"}]},"Start":{},"End":{}}';

    const analysis = analyzePipelineSource(source);
    const duplicate = analysis.diagnostics.find(
      (diagnostic) => diagnostic.code === "pipeline.duplicate_key",
    );
    const reference = analysis.diagnostics.find(
      (diagnostic) => diagnostic.code === "pipeline.reference.invalid",
    );

    expect(analysis.syntaxValid).toBe(true);
    expect(duplicate).toMatchObject({
      offset: source.lastIndexOf('"Start"'),
      length: '"Start"'.length,
      supportLevel: "graph-unsupported",
    });
    expect(source.slice(reference!.offset, reference!.offset + reference!.length)).toBe(
      '{"name":"End","anchor":"yes"}',
    );
  });

  it("returns a located unparseable diagnostic for invalid JSONC", () => {
    const source = '// invalid\n{"Start": }\n';
    const analysis = analyzePipelineSource(source);

    expect(analysis.syntaxValid).toBe(false);
    expect(analysis.diagnostics[0]).toMatchObject({
      severity: "error",
      supportLevel: "unparseable",
      path: [],
    });
    expect(analysis.diagnostics[0].offset).toBeGreaterThanOrEqual(
      source.indexOf('"Start"') + '"Start"'.length,
    );
    expect(analysis.diagnostics[0].length).toBeGreaterThan(0);
  });
});
