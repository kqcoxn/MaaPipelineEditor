import { canvasCommandBus } from "../capabilities/canvas/commandBus";
import { canvasHarnessModule } from "../capabilities/canvas/module";
import { canvasToolDefinitions } from "../capabilities/canvas/tools";
import type { CapabilityPack } from "../core/types";
import { HarnessRunner, type HarnessRunnerDependencies } from "../runtime/runner";
import {
  mfwPipelineReferenceTool,
  mfwPipelineSkill,
} from "../skills/mfw-pipeline/definition";
import { mfwPipelineHarnessModule } from "../skills/mfw-pipeline/module";
import { registerHarnessModules } from "./registerModules";

export const canvasCapabilityPack: CapabilityPack = {
  id: "canvas",
  version: "1.0.0",
  description: "MaaFW Pipeline 协议及当前文件画布、节点和连接的完整受控操作",
  skillIds: [mfwPipelineSkill.id],
  toolNames: [
    ...canvasToolDefinitions.map((tool) => tool.name),
    mfwPipelineReferenceTool.name,
  ],
};

export function createDefaultHarnessDependencies(): HarnessRunnerDependencies {
  const { registry, toolHandlers } = registerHarnessModules([
    canvasHarnessModule,
    mfwPipelineHarnessModule,
  ]);
  registry.registerCapabilityPack(canvasCapabilityPack);
  return {
    registry,
    toolHandlers,
    readContextSnapshot: () => canvasCommandBus.readSummary(),
    getContextStateVersion: () => canvasCommandBus.getStateVersion(),
    validateContext: (context) => canvasCommandBus.validateCanvas(context),
  };
}

export const harnessRunner = new HarnessRunner(
  createDefaultHarnessDependencies(),
);
