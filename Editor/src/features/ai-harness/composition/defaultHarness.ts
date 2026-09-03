import { canvasCommandBus } from "../capabilities/canvas/commandBus";
import { businessArchitectureHarnessModule } from "../capabilities/business-architecture/module";
import { canvasHarnessModule } from "../capabilities/canvas/module";
import { CANVAS_CAPABILITY_PACK_ID } from "../capabilities/canvas/profile";
import { canvasToolDefinitions } from "../capabilities/canvas/tools";
import { semanticLayoutHarnessModule } from "../capabilities/semantic-layout/module";
import type { CapabilityPack } from "../core/types";
import { HarnessRunner, type HarnessRunnerDependencies } from "../runtime/runner";
import {
  mfwPipelineReferenceTool,
  mfwPipelineSkill,
} from "../skills/mfw-pipeline/definition";
import { mfwPipelineHarnessModule } from "../skills/mfw-pipeline/module";
import { registerHarnessModules } from "./registerModules";

export const canvasCapabilityPack: CapabilityPack = {
  id: CANVAS_CAPABILITY_PACK_ID,
  version: "1.1.0",
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
    semanticLayoutHarnessModule,
    businessArchitectureHarnessModule,
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
