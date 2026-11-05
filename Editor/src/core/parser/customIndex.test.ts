import { afterEach, describe, expect, it } from "vitest";
import { useConfigStore } from "@/stores/app/configStore";
import { NodeTypeEnum } from "@/components/flow/nodes";
import { convertMfwToStoreFormat, parsePipelineNodeForExport } from "./nodeParser";
import type { PipelineNodeType } from "./types";

const configs = useConfigStore.getState().configs;
afterEach(() => useConfigStore.setState({ configs }));

describe.each(["v1", "v2"] as const)("%s Custom results", version => {
  it("preserves positive and negative indices through import and export", () => {
    useConfigStore.setState({ configs: { ...configs, pipelineProtocolVersion: version } });
    for (const index of [-1, 2]) {
      const param = { custom_recognition: "FindItems", custom_recognition_param: { tag: "目标" }, index };
      const source = version === "v1" ? { recognition: "Custom", ...param } : { recognition: { type: "Custom", param } };
      const node: PipelineNodeType = {
        id: "custom", type: NodeTypeEnum.Pipeline, position: { x: 0, y: 0 },
        data: { label: "Start", recognition: { type: "DirectHit", param: {} }, action: { type: "DoNothing", param: {} }, others: {}, extras: {} },
      };
      node.data = convertMfwToStoreFormat(source, node);
      expect(node.data.recognition.param.index).toBe(index);
      expect(node.data.extras).not.toHaveProperty("index");
      const exported = parsePipelineNodeForExport(node, [node]);
      expect(version === "v1" ? exported.index : (exported.recognition as { param: { index: number } }).param.index).toBe(index);
    }
  });
});
