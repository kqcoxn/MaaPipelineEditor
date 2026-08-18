import type { HarnessModule } from "../../core/types";
import {
  mfwPipelineReferenceTool,
  mfwPipelineSkill,
  mfwPipelineToolHandlers,
} from "./definition";

export const mfwPipelineHarnessModule: HarnessModule = {
  skills: [mfwPipelineSkill],
  tools: [mfwPipelineReferenceTool],
  toolHandlers: mfwPipelineToolHandlers,
};
