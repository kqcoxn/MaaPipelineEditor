import { expect, it } from "vitest";
import { otherFieldSchema } from "../fields/other/schema";
import { matchParamType } from "./typeMatchers";
import { convertMfwToStoreFormat, parsePipelineNodeForExport } from "./nodeParser";
import type { PipelineNodeType } from "./types";
import { NodeTypeEnum } from "../../components/flow/nodes";

it("preserves trace-only focus objects and display channels", () => {
  const focus = { "Node.PipelineNode.Failed": { trace: false }, "Node.Action.Succeeded": { content: "完成", display: ["log", "toast"], trace: true } };
  expect(matchParamType({ focus }, [otherFieldSchema.focus]).focus).toEqual(focus);
});

it.each([null, false, true, 0, 1.5, "", "false", '{"custom":true}', {}, [], [false, 1, "x"], { custom: [null, false] }])(
  "round-trips arbitrary focus JSON without changing its type: %j",
  (focus) => {
    const node: PipelineNodeType = {
      id: "focus-test", type: NodeTypeEnum.Pipeline, position: { x: 0, y: 0 },
      data: { label: "Start", recognition: { type: "DirectHit", param: {} }, action: { type: "DoNothing", param: {} }, others: {}, extras: {} },
    };
    node.data = convertMfwToStoreFormat({ focus }, node);
    const exported = parsePipelineNodeForExport(node, [node]);
    expect(exported).toHaveProperty("focus");
    expect(exported.focus).toEqual(focus);
    expect(JSON.parse(JSON.stringify(exported)).focus).toEqual(focus);
  },
);
