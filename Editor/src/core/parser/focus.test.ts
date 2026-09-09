import { expect, it } from "vitest";
import { otherFieldSchema } from "../fields/other/schema";
import { matchParamType } from "./typeMatchers";

it("preserves trace-only focus objects and display channels", () => {
  const focus = { "Node.PipelineNode.Failed": { trace: false }, "Node.Action.Succeeded": { content: "完成", display: ["log", "toast"], trace: true } };
  expect(matchParamType({ focus }, [otherFieldSchema.focus]).focus).toEqual(focus);
});
