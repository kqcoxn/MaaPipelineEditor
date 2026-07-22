import { Modal } from "antd";
import { parse, type ParseError } from "jsonc-parser";

import { LayoutHelper } from "../layout";
import { ClipboardHelper } from "../../utils/ui/clipboard";
import { useFlowStore } from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import {
  buildPipelineProjection,
  type BuildPipelineProjectionOptions,
} from "../../features/pipeline-document/pipelineProjectionBuilder";
import type { PipelineToFlowOptions } from "./types";

export { buildPipelineProjection };
export type { BuildPipelineProjectionOptions };

/**
 * Legacy import entry. Project documents use the pipeline-document service;
 * clipboard and compatibility callers still apply the same pure projection.
 */
export async function pipelineToFlow(
  options?: PipelineToFlowOptions,
): Promise<boolean> {
  try {
    const source = options?.pString ?? (await ClipboardHelper.read());
    const normalized = source.trim() === "" || source.trim() === "null" ? "{}" : source;
    const errors: ParseError[] = [];
    const pipeline = parse(normalized, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    }) as Record<string, unknown> | undefined;
    if (errors.length || !pipeline || Array.isArray(pipeline)) {
      throw new Error("Pipeline JSONC 无法解析");
    }
    const projection = buildPipelineProjection({
      pipeline,
      keyOrder: Object.keys(pipeline),
      mpeConfig: options?.mpeConfig,
    });
    applyLegacyProjection(projection);
    return true;
  } catch (error) {
    Modal.error({
      title: "导入失败！",
      content:
        "请检查 Pipeline 格式是否正确，或版本是否一致，详细错误请查看控制台。",
    });
    console.error(error);
    return false;
  }
}

function applyLegacyProjection(
  projection: ReturnType<typeof buildPipelineProjection>,
): void {
  if (useFileStore.getState().files.length === 0) {
    useFileStore.getState().addFile({ isSwitch: true });
  }
  const flowStore = useFlowStore.getState();
  flowStore.importHistory(projection.nodes, projection.edges);
  flowStore.replace(projection.nodes, projection.edges, {
    isFitView: projection.hasAuthoredPositions,
    skipHistory: true,
  });
  const fileStore = useFileStore.getState();
  if (projection.config.prefix) fileStore.setFileConfig("prefix", projection.config.prefix);
  fileStore.setFileConfig("coordinateMode", projection.config.coordinateMode);
  fileStore.setFileConfig("nodeOrderMap", projection.config.nodeOrderMap);
  fileStore.setFileConfig("nextOrderNumber", projection.config.nextOrderNumber);
  if (!projection.hasAuthoredPositions) LayoutHelper.auto();
}
