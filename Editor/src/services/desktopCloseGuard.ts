import { invoke } from "@tauri-apps/api/core";

import { confirmUnsavedTransition } from "./editorDirtyState";

export interface DesktopCloseDependencies {
  confirmExit: () => Promise<boolean>;
  exitApplication: () => Promise<unknown>;
}

const defaultDependencies: DesktopCloseDependencies = {
  confirmExit: () => confirmUnsavedTransition("exit-application"),
  exitApplication: () => invoke("exit_app"),
};

export async function handleDesktopCloseRequest(
  dependencies: DesktopCloseDependencies = defaultDependencies,
): Promise<boolean> {
  if (!(await dependencies.confirmExit())) return false;
  await dependencies.exitApplication();
  return true;
}
