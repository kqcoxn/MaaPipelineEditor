import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), address: 'ws://test' }));
vi.mock('@/services/server', () => ({ interfaceProtocol: { requestEditor: mocks.request }, localServer: { getAddress: () => mocks.address } }));
import { usePiEditorStore as store, piDirty } from './store';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { renameDefinition, moveDefinition } from './operations';
import type { PiProject } from './types';
const a = '/project/tasks/a.json', b = '/project/other/a.json';
let project: PiProject;
beforeEach(() => {
  mocks.address = 'ws://test'; mocks.request.mockReset();
  project = { entryPath: '/project/interface.json', documents: [
    { path: '/project/interface.json', relativePath: 'interface.json', kind: 'entry', content: '{"import":["tasks/a.json","other/a.json"]}', version: 'entry-v1', imported: true },
    { path: a, relativePath: 'tasks/a.json', kind: 'fragment', content: '{"task":[{"name":"A","entry":"Start","option":["shared"]}],"option":{"shared":{"type":"select","cases":[{"name":"yes"}]}}}', version: 'a-v1', imported: true },
    { path: b, relativePath: 'other/a.json', kind: 'fragment', content: '{"task":[{"name":"B","entry":"Start","option":["shared"]}]}', version: 'b-v1', imported: true },
  ], definitions: [{ kind: 'option', name: 'shared', file: a, pointer: '/option/shared', effective: true }, { kind: 'task', name: 'A', file: a, pointer: '/task/0', effective: true }], references: [{ kind: 'option', name: 'shared', file: a, pointer: '/task/0/option/0', effective: true }, { kind: 'option', name: 'shared', file: b, pointer: '/task/0/option/0', effective: true }], diagnostics: [] };
  store.setState({ project: undefined, tabs: [], address: '', busy: false, error: undefined, revision: 0 });
  mocks.request.mockImplementation(async () => structuredClone(project));
  useWorkspaceStore.getState().showCanvas();
});
describe('PI workspace drafts', () => {
  it('reports a missing entry read error without opening an empty JSON draft', async () => {
    const entry = project.documents[0];
    entry.content = ''; entry.version = 'missing';
    entry.error = `open ${entry.path}: no such file or directory`;
    await expect(store.getState().open(entry.path)).rejects.toThrow('无法读取 PI 文件');
    expect(store.getState().tabs).toHaveLength(0);
    expect(useWorkspaceStore.getState().view).toBe('canvas');
  });
  it('still opens existing invalid source for repair', async () => {
    const entry = project.documents[0];
    entry.content = ''; entry.error = 'unexpected EOF';
    await store.getState().open(entry.path);
    expect(store.getState().tabs[0]).toMatchObject({ content: '', mode: 'source', version: 'entry-v1' });
  });
  it('opens same-named files independently, deduplicates by path, retains selection and undo', async () => {
    await store.getState().open(a, '/task/0'); store.getState().patch(a, '/task/0/entry', 'Edited');
    await store.getState().open(b); await store.getState().open(a);
    expect(store.getState().tabs).toHaveLength(2); expect(store.getState().tabs[0].selected).toBe('/task/0');
    expect(store.getState().tabs[0].content).toContain('Edited');
    store.getState().history(a); expect(store.getState().tabs[0].content).toContain('Start');
    expect(store.getState().tabs[1].undo).toHaveLength(0);
  });
  it('renames a shared option and both file references as one undo/save group', async () => {
    await store.getState().open(a);
    await renameDefinition(project.definitions[0], 'renamed');
    expect(store.getState().tabs.every(t => t.content.includes('renamed'))).toBe(true);
    expect(store.getState().tabs.every(t => t.group.length === 2)).toBe(true);
    store.getState().history(b); expect(store.getState().tabs.every(t => !t.content.includes('renamed'))).toBe(true);
    store.getState().history(a, true);
    await store.getState().save(b);
    const request = mocks.request.mock.calls.find(c => c[0] === 'save')![1];
    expect(request.changes).toHaveLength(2); expect(request.versions[a]).toBe('a-v1');
  });
  it('refreshes clean tabs and preserves dirty drafts after external changes', async () => {
    await store.getState().open(a); await store.getState().open(b);
    store.getState().patch(a, '/task/0/entry', 'MyDraft');
    project.documents[1].version = 'a-v2'; project.documents[1].content = '{"task":[]}';
    project.documents[2].version = 'b-v2'; project.documents[2].content = '{"task":[]}';
    await store.getState().refresh();
    expect(store.getState().tabs[0].content).toContain('MyDraft'); expect(store.getState().tabs[0].version).toBe('a-v1'); expect(store.getState().tabs[0].conflict).toBeTruthy();
    expect(store.getState().tabs[1].content).toBe('{"task":[]}');
  });
  it('keeps drafts when save fails or LocalBridge changes', async () => {
    await store.getState().open(a); store.getState().patch(a, '/task/0/entry', 'Edited');
    mocks.request.mockImplementation(async action => { if (action === 'save') throw new Error('conflict'); return structuredClone(project); });
    expect(await store.getState().save(a)).toBe(false); expect(piDirty(store.getState().tabs[0])).toBe(true); expect(store.getState().error).toContain('conflict');
    mocks.address = 'ws://another'; expect(await store.getState().save(a)).toBe(false);
  });
  it('moves tasks without moving shared options', async () => {
    await store.getState().open(a);
    await moveDefinition(project.definitions[1], b, false);
    expect(store.getState().tabs.find(t => t.path === a)!.content).toContain('"shared"');
    expect(JSON.parse(store.getState().tabs.find(t => t.path === b)!.content).task).toHaveLength(2);
  });
  it('rejects moving options that have external references', async () => {
    await store.getState().open(a);
    await expect(moveDefinition(project.definitions[1], b, true)).rejects.toThrow('外部引用');
    expect(store.getState().tabs.every(t => !piDirty(t))).toBe(true);
  });
  it('keeps selection attached to reordered objects and restores content and selection on undo/redo', async () => {
    const content = '{"task":[{"name":"A",/* A comment */"entry":"Start"},{"name":"B"},{"name":"C"}]}';
    project.documents[1].content = content;
    await store.getState().open(a, '/task/1');
    store.getState().reorder(a, '/task', 0, 2);
    expect(store.getState().tabs[0].selected).toBe('/task/0');
    expect(JSON.parse(store.getState().tabs[0].content.replace('/* A comment */', '')).task.map((t: { name: string }) => t.name)).toEqual(['B', 'C', 'A']);
    expect(store.getState().tabs[0].content).toContain('/* A comment */');
    store.getState().history(a);
    expect(store.getState().tabs[0]).toMatchObject({ content, selected: '/task/1' });
    store.getState().history(a, true);
    expect(store.getState().tabs[0].selected).toBe('/task/0');
    store.getState().reorder(a, '/task', 0, 2);
    expect(store.getState().tabs[0].selected).toBe('/task/2');
    store.getState().reorder(a, '/task', 2, 0);
    expect(store.getState().tabs[0].selected).toBe('/task/0');
  });
  it('ignores unavailable targets and busy reorders without creating undo entries', async () => {
    await store.getState().open(a);
    store.getState().reorder(a, '/task', 0, 99);
    expect(store.getState().tabs[0].undo).toHaveLength(0);
    store.setState({ busy: true });
    store.getState().reorder(a, '/task', 0, 1);
    expect(store.getState().tabs[0].undo).toHaveLength(0);
  });
  it('does not replace an invalid draft during navigation', async () => {
    await store.getState().open(a); store.getState().update(a, '{broken'); await store.getState().open(b); await store.getState().open(a);
    expect(store.getState().tabs[0].content).toBe('{broken'); expect(await store.getState().validate()).toBeUndefined();
  });
});
