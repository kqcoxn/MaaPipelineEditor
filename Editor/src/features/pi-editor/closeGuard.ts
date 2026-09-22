// The desktop host reads this guard without importing editor/runtime dependencies.
let unsaved: (() => boolean) | undefined;
export const hasUnsavedPiSession = () => unsaved?.() ?? false;
export function registerPiCloseGuard(check: () => boolean) {
  unsaved = check;
  return () => { if (unsaved === check) unsaved = undefined; };
}
