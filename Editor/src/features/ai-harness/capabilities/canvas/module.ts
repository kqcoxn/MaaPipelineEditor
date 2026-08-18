import type { HarnessModule } from "../../core/types";
import { canvasChatProfile } from "./profile";
import { canvasToolDefinitions, canvasToolHandlers } from "./tools";

export const canvasHarnessModule: HarnessModule = {
  profiles: [canvasChatProfile],
  tools: canvasToolDefinitions,
  toolHandlers: canvasToolHandlers,
};
