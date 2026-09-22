import { usePiEditorStore } from "@/features/pi-editor/store";
import { projectBinding } from "../capabilities/project-interface/context";
import { piCommandBus } from "../capabilities/project-interface/commandBus";
import { readWorkspaceContext, validateWorkspace } from "./workspaceContext";
import { piHarnessModule } from "../capabilities/project-interface/module";
import { piSkillsModule } from "../skills/project-interface/module";
import { piToolDefinitions } from "../capabilities/project-interface/tools";
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
  version: "1.2.0",
  description: "PI 项目查询、配置分析、关联草稿及当前 Pipeline 画布的受控操作",
  skillIds: [mfwPipelineSkill.id, "maafw-project-interface", "mpe-pi-editing"],
  toolNames: [
    ...piToolDefinitions.map(tool => tool.name),
    ...canvasToolDefinitions.map((tool) => tool.name),
    mfwPipelineReferenceTool.name,
  ],
};

export function createDefaultHarnessDependencies(): HarnessRunnerDependencies {
  const { registry, toolHandlers } = registerHarnessModules([
    canvasHarnessModule,
    piHarnessModule,
    piSkillsModule,
    mfwPipelineHarnessModule,
    semanticLayoutHarnessModule,
    businessArchitectureHarnessModule,
  ]);
  registry.registerCapabilityPack(canvasCapabilityPack);
  return {
    registry,
    toolHandlers,
    getProjectBinding: projectBinding,
    getPiRevision: () => usePiEditorStore.getState().revision,
    releaseContext: runId => piCommandBus.release(runId),
    readContextSnapshot: readWorkspaceContext,
    getContextStateVersion: () => canvasCommandBus.getStateVersion(),
    validateContext: validateWorkspace,
  };
}

export const harnessRunner = new HarnessRunner(
  createDefaultHarnessDependencies(),
);
