import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/server', () => ({
  interfaceProtocol: { requestEditor: vi.fn(), onChanged: () => () => {}, onStatus: () => () => {} },
  localServer: { getAddress: () => 'test' },
}));
vi.mock('./dialogs', () => ({ savePiTab: mocks.save, reportPiError: vi.fn() }));
vi.mock('@/utils/platform', () => ({ detectPlatform: () => 'windows' }));
import { initializePiEditor } from './lifecycle';
import { usePiEditorStore as store } from './store';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { useWSStore } from '@/stores/connection/wsStore';
const path = '/project/a.json';
let dispose: () => void;
beforeEach(() => {
  mocks.save.mockClear(); useWSStore.setState({ connected: false });
  store.setState({ tabs: [{ path, relativePath: 'a.json', kind: 'fragment', content: '{}', base: '{}', version: 'v1', imported: true, selected: '', mode: 'form', undo: [], redo: [], group: [path] }], project: undefined, busy: false, revision: 0 });
  useWorkspaceStore.getState().showPi(path);
  dispose = initializePiEditor();
});
afterEach(() => { dispose(); });
describe('PI keyboard routing', () => {
  it('saves only the active PI file and does not intercept Pipeline saves', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(mocks.save).toHaveBeenCalledWith(path);
    useWorkspaceStore.getState().showCanvas();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('routes document undo to PI and leaves native input undo alone', () => {
    store.getState().update(path, '{"task":[]}');
    const input = document.createElement('input'); document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(store.getState().tabs[0].content).toContain('task'); input.remove();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(store.getState().tabs[0].content).toBe('{}');
  });
});
