import { afterEach, describe, expect, it } from "vitest";
import { actionFields, actionParamKeys } from "../fields";
import { useConfigStore } from "../../stores/app/configStore";
import { NodeTypeEnum } from "../../components/flow/nodes";
import { convertMfwToStoreFormat, parsePipelineNodeForExport } from "./nodeParser";
import type { PipelineNodeType } from "./types";

const configs = useConfigStore.getState().configs;
afterEach(() => useConfigStore.setState({ configs }));

describe.each(["v1", "v2"] as const)("%s auto_up", (version) => {
  it.each(["TouchDown", "KeyDown"])("round-trips %s as an action parameter", (type) => {
    useConfigStore.setState({ configs: { ...configs, pipelineProtocolVersion: version } });
    expect(actionParamKeys[type].all).toContain("auto_up");
    expect(actionFields[type].params.find(field => field.key === "auto_up")?.default).toBe(false);
    for (const auto_up of [true, false]) {
      const param = { ...(type === "KeyDown" ? { key: 65 } : { target: [10, 20] }), auto_up };
      const source = version === "v1" ? { action: type, ...param } : { action: { type, param } };
      const node: PipelineNodeType = {
        id: "auto-up", type: NodeTypeEnum.Pipeline, position: { x: 0, y: 0 },
        data: { label: "Start", recognition: { type: "DirectHit", param: {} }, action: { type: "DoNothing", param: {} }, others: {}, extras: {} },
      };
      node.data = convertMfwToStoreFormat(source, node);
      expect(node.data.action.param.auto_up).toBe(auto_up);
      expect(node.data.extras).not.toHaveProperty("auto_up");
      const exported = parsePipelineNodeForExport(node, [node]);
      expect(version === "v1" ? exported.auto_up : (exported.action as { param: { auto_up: boolean } }).param.auto_up).toBe(auto_up);
    }
  });
});

it.each(["TouchMove", "TouchUp", "KeyUp"])("does not offer auto_up for %s", type => {
  expect(actionParamKeys[type].all).not.toContain("auto_up");
});
