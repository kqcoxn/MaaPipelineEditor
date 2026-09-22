import { registerPiCloseGuard } from './closeGuard';
import { interfaceProtocol } from '@/services/server';
import { useWSStore } from '@/stores/connection/wsStore';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { matchesShortcut } from '@/utils/shortcuts';
import { usePiEditorStore as store, piDirty } from './store';
import { reportPiError, savePiTab } from './dialogs';

export function initializePiEditor() {
  let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false; let again = false;
  const refresh = async () => {
    if (stopped || !useWSStore.getState().connected) return;
    if (refreshing) { again = true; return; }
    refreshing = true;
    try { await store.getState().refresh(); } catch (error) { if (store.getState().tabs.length) store.setState({ error: String(error) }); }
    finally { refreshing = false; if (again && !stopped) { again = false; void refresh(); } }
  };
  const off = [registerPiCloseGuard(() => store.getState().tabs.some(piDirty)),interfaceProtocol.onChanged(() => void refresh()), interfaceProtocol.onStatus(() => void refresh()), useWSStore.subscribe(s => s.connected, connected => { if (connected) void refresh(); }), store.subscribe(s => s.revision, () => {
    clearTimeout(timer); timer = setTimeout(() => { if (!stopped) void store.getState().validate().catch(error => store.setState({ error: String(error) })); }, 400);
  })];
  const beforeUnload = (event: BeforeUnloadEvent) => { if (store.getState().tabs.some(piDirty)) { event.preventDefault(); event.returnValue = ''; } };
  const keys = (event: KeyboardEvent) => {
    const state = useWorkspaceStore.getState(); if (state.view !== 'pi' || !state.piPath) return;
    if (matchesShortcut(event, 'save')) { event.preventDefault(); event.stopImmediatePropagation(); void savePiTab(state.piPath).catch(reportPiError); }
    // Native text editors handle their own text undo; outside inputs, undo the active document.
    const element = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA'].includes(element.tagName) || element.isContentEditable) return;
    if (matchesShortcut(event, 'undo') || matchesShortcut(event, 'redo')) { event.preventDefault(); event.stopImmediatePropagation(); store.getState().history(state.piPath, matchesShortcut(event, 'redo')); }
  };
  window.addEventListener('beforeunload', beforeUnload); document.addEventListener('keydown', keys, true);
  void refresh();
  return () => { stopped = true; clearTimeout(timer); off.forEach(dispose => dispose()); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('keydown', keys, true); };
}
