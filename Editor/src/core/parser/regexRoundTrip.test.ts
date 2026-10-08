import { afterEach, expect, it } from "vitest";
import { pipelineToFlow } from "./importer";
import { flowToPipelineString } from "./exporter";
import { useFlowStore } from "@/stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import { NodeTypeEnum } from "@/components/flow/nodes";
import type { PipelineNodeType } from "./types";

const configs = useConfigStore.getState().configs;
afterEach(() => useConfigStore.setState({ configs }));

it.each([
  ["raw", "v1"], ["raw", "v2"], ["json", "v1"], ["json", "v2"],
] as const)("%s / %s 文件导入、只改 ROI、重复保存不改变正则", async (mode, version) => {
  useConfigStore.setState({ configs: { ...configs, regexInputMode: mode, pipelineProtocolVersion: version } });
  const expected = [String.raw`(^|\D)0次`, String.raw`\\d+`, '"引号"\n'];
  for (const replace of [[String.raw`\d+`, "$1"], [[String.raw`\d+`, String.raw`\path`], ["a,b", '"c"']]]) {
    const param = { expected, replace, roi: [1,2,3,4] };
    let source = JSON.stringify({ Start: { ...(version === "v1" ? { recognition: "OCR", ...param } : { recognition: { type: "OCR", param } }), $__mpe_code: { position: { x: 0, y: 0 } } } });
    for (let round = 0; round < 3; round++) {
      expect(await pipelineToFlow({ pString: source })).toBe(true);
      const node = useFlowStore.getState().nodes.find(node => node.type === NodeTypeEnum.Pipeline) as PipelineNodeType;
      expect(node.data.recognition.param.expected).toEqual(expected);
      expect(node.data.recognition.param.replace).toEqual(replace);
      node.data.recognition.param.roi = [360,1124,343,139];
      source = flowToPipelineString({ nodes: [node], edges: [] });
      const exported = JSON.parse(source).Start;
      const saved = version === "v1" ? exported : exported.recognition.param;
      expect(saved.expected).toEqual(expected);
      expect(saved.replace).toEqual(replace);
      expect(saved.roi).toEqual([360,1124,343,139]);
    }
  }
});
