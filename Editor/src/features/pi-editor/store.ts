import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { interfaceProtocol, localServer } from '@/services/server';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { editJson, readJson, reorderJson } from './json';
import type { PiProject, PiTab, PiHistory, PiChange, PiDocument } from './types';

interface PiState { project?: PiProject; address: string; tabs: PiTab[]; busy: boolean; error?: string; revision: number }
interface PiActions {
  applyHarnessBatch: (project: PiProject, contents: Record<string, string>) => void;
  refresh: () => Promise<void>;
  open: (path: string, selected?: string) => Promise<void>;
  update: (path: string, content: string) => void;
  reorder: (path: string, pointer: string, from: number, to: number) => void;
  patch: (path: string, pointer: string, value: unknown) => void;
  batch: (contents: Record<string, string>) => void;
  select: (path: string, selected: string) => void;
  mode: (path: string, mode: 'form' | 'source') => void;
  history: (path: string, redo?: boolean) => void;
  save: (path: string) => Promise<boolean>;
  discard: (path: string) => void;
  close: (path: string) => void;
  validate: () => Promise<PiProject | undefined>;
  create: (relativePath: string, imported: boolean) => Promise<string>;
  rebase: (path: string) => Promise<void>;
}
const tabFrom = (doc: PiDocument): PiTab => ({ ...doc, base: doc.content, selected: '', mode: doc.error ? 'source' : 'form', undo: [], redo: [], group: [doc.path] });
export const piDirty = (tab: PiTab) => tab.content !== tab.base || tab.version === 'missing';
export const usePiEditorStore = create<PiState & PiActions>()(subscribeWithSelector((set, get) => ({
  address: '', tabs: [], busy: false, revision: 0,
  applyHarnessBatch(project, contents) {
    const state = get();
    if (state.busy) throw new Error('PI 正在保存，请稍后重试');
    const sameProject = state.project?.entryPath === project.entryPath && state.address === localServer.getAddress();
    if (!sameProject && state.tabs.some(piDirty)) throw new Error('另一项目仍有未保存草稿');
    const documents = Object.keys(contents).map(path => {
      const doc = project.documents.find(d => d.path === path);
      if (!doc || doc.version === 'missing') throw new Error('仅支持已读取的现有 PI 文档');
      const tab = sameProject ? state.tabs.find(t => t.path === path) : undefined;
      if (tab && (tab.version !== doc.version || tab.content !== doc.content)) throw new Error('PI 草稿已变化');
      return doc;
    });
    const tabs = sameProject ? [...state.tabs] : [];
    documents.forEach(doc => { if (!tabs.some(t => t.path === doc.path)) tabs.push(tabFrom(doc)); });
    // Loading and applying happen synchronously without navigation or an await boundary.
    set({ project, address: localServer.getAddress(), tabs });
    get().batch(contents);
  },
  async refresh() {
    const address = localServer.getAddress();
    const state = get();
    const project = await interfaceProtocol.requestEditor('read', { paths: state.address === address ? state.tabs.map(t => t.path) : [] });
    if (localServer.getAddress() !== address) return;
    const switched = state.project && (state.project.entryPath !== project.entryPath || state.address !== address);
    if (switched && get().tabs.some(piDirty)) throw new Error('原项目仍有未保存文件，请先处理草稿，再切换 PI 项目');
    set(s => ({ project, address, error: undefined, revision: s.revision + 1, tabs: switched ? [] : s.tabs.map(tab => {
      const doc = project.documents.find(d => d.path === tab.path);
      if (!doc || doc.version === 'missing') return tab.version === 'missing' ? tab : { ...tab, conflict: '磁盘文件不存在', imported: false };
      if (doc.version === tab.version) return { ...tab, imported: doc.imported };
      if (doc.content === tab.content) return { ...tab, base: doc.content, version: doc.version, conflict: undefined, imported: doc.imported };
      if (piDirty(tab)) return { ...tab, conflict: '文件已被外部修改，请对比后合并' };
      return { ...tabFrom(doc), selected: tab.selected, mode: tab.mode };
    }) }));
  },
  async open(path, selected = '') {
    const existing = get().tabs.find(t => t.path === path);
    if (!existing) {
      if (!get().project) await get().refresh();
      let doc = get().project?.documents.find(d => d.path === path);
      if (!doc) {
        const project = await interfaceProtocol.requestEditor('read', { entryPath: get().project!.entryPath, paths: [path] });
        doc = project.documents.find(d => d.path === path || d.relativePath === path);
      }
      if (!doc) throw new Error('文件不存在');
      // A failed disk read is not an empty JSON draft. Missing files are only
      // opened by create(), which supplies an explicit in-memory document.
      if (doc.version === 'missing') throw new Error(`无法读取 PI 文件：${doc.path}\n${doc.error ?? '文件不存在，请检查项目入口或导入路径'}`);
      path = doc.path;
      set(s => ({ tabs: s.tabs.some(t => t.path === path) ? s.tabs : [...s.tabs, tabFrom(doc!)] }));
    }
    if (selected) get().select(path, selected);
    useWorkspaceStore.getState().showPi(path);
  },
  update(path, content) { get().batch({ [path]: content }); },
  reorder(path, pointer, from, to) {
    const tab = get().tabs.find(t => t.path === path);
    if (!tab || get().busy || from === to) return;
    const content = reorderJson(tab.content, pointer, from, to);
    if (content === tab.content) return;
    // Keep the selected object attached to its contents when array indices shift.
    const prefix = pointer + '/';
    let selected = tab.selected;
    if (selected.startsWith(prefix)) {
      const [part, ...rest] = selected.slice(prefix.length).split('/');
      const index = Number(part);
      if (/^\d+$/.test(part)) {
        const next = index === from ? to : from < to && index > from && index <= to ? index - 1 : from > to && index >= to && index < from ? index + 1 : index;
        selected = prefix + [String(next), ...rest].join('/');
      }
    }
    get().update(path, content);
    get().select(path, selected);
  },
  patch(path, pointer, value) {
    const tab = get().tabs.find(t => t.path === path); if (!tab) return;
    get().update(path, editJson(tab.content, pointer, value));
  },
  batch(contents) {
    const state = get();
    if (state.busy) return;
    const changed = Object.keys(contents).filter(path => state.tabs.some(t => t.path === path && t.content !== contents[path]));
    if (!changed.length) return;
    const group = new Set(changed);
    for (const tab of state.tabs) if (changed.includes(tab.path)) tab.group.forEach(p => group.add(p));
    const frame: PiHistory = { contents: {}, selected: {} };
    for (const tab of state.tabs) if (group.has(tab.path)) { frame.contents[tab.path] = tab.content; frame.selected[tab.path] = tab.selected; }
    set({ tabs: state.tabs.map(t => group.has(t.path) ? { ...t, content: contents[t.path] ?? t.content, undo: [...t.undo, frame].slice(-100), redo: [], group: [...group] } : t), revision: state.revision + 1, error: undefined });
  },
  select(path, selected) { set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, selected } : t) })); },
  mode(path, mode) { set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, mode } : t) })); },
  history(path, redo = false) {
    const state = get(); const tab = state.tabs.find(t => t.path === path);
    const frame = (redo ? tab?.redo : tab?.undo)?.at(-1); if (!frame) return;
    const reverse: PiHistory = { contents: {}, selected: {} };
    for (const t of state.tabs) if (t.path in frame.contents) { reverse.contents[t.path] = t.content; reverse.selected[t.path] = t.selected; }
    set({ tabs: state.tabs.map(t => t.path in frame.contents ? { ...t, content: frame.contents[t.path], selected: frame.selected[t.path], undo: redo ? [...t.undo, reverse] : t.undo.slice(0, -1), redo: redo ? t.redo.slice(0, -1) : [...t.redo, reverse] } : t), revision: state.revision + 1 });
  },
  async save(path) {
    const state = get(); if (state.busy || !state.project) return false;
    const tab = state.tabs.find(t => t.path === path); if (!tab) return false;
    if (localServer.getAddress() !== state.address) { set({ error: 'LocalBridge 已切换，请连接原服务处理草稿' }); return false; }
    const tabs = state.tabs.filter(t => tab.group.includes(t.path) && piDirty(t));
    if (!tabs.length) return true;
    const changes = tabs.map(t => ({ path: t.path, content: t.content, version: t.version }));
    set({ busy: true, error: undefined });
    try {
      const project = await interfaceProtocol.requestEditor('save', { entryPath: state.project.entryPath, paths: state.tabs.map(t => t.path), changes, versions: Object.fromEntries(state.project.documents.map(d => [d.path, state.tabs.find(t => t.path === d.path)?.version ?? d.version])) });
      set(s => ({ project, tabs: s.tabs.map(t => {
        const saved = changes.find(c => c.path === t.path); const doc = project.documents.find(d => d.path === t.path);
        return saved && doc ? { ...t, version: doc.version, base: saved.content, imported: doc.imported, conflict: undefined, group: [t.path], undo: [], redo: [] } : tab.group.includes(t.path) ? { ...t, group: [t.path], undo: [], redo: [] } : t;
      }), revision: s.revision + 1 }));
      return true;
    } catch (error) { await get().refresh().catch(() => {}); set({ error: String(error) }); return false; }
    finally { set({ busy: false }); }
  },
  discard(path) {
    const tab = get().tabs.find(t => t.path === path); if (!tab) return;
    set(s => ({ tabs: s.tabs.filter(t => !(tab.group.includes(t.path) && t.version === 'missing')).map(t => tab.group.includes(t.path) ? { ...t, content: t.base, undo: [], redo: [], group: [t.path] } : t), revision: s.revision + 1 }));
  },
  close(path) { set(s => ({ tabs: s.tabs.filter(t => t.path !== path) })); if (useWorkspaceStore.getState().piPath === path) { const last = get().tabs.at(-1); if (last) useWorkspaceStore.getState().showPi(last.path); else useWorkspaceStore.getState().showCanvas(); } },
  async validate() {
    const state = get(); if (!state.project || state.address !== localServer.getAddress()) return;
    const changes: PiChange[] = state.tabs.filter(piDirty).map(t => ({ path: t.path, version: t.version, content: t.content }));
    if (changes.some(c => readJson(c.content).error)) return;
    const project = await interfaceProtocol.requestEditor('validate', { entryPath: state.project.entryPath, paths: state.tabs.map(t => t.path), changes });
    if (get().revision === state.revision && get().project?.entryPath === project.entryPath) set(s => ({ tabs: s.tabs.map(t => ({ ...t, imported: project.documents.find(d => d.path === t.path)?.imported ?? false })), project: { ...project, documents: project.documents.map(d => ({ ...d, version: s.project?.documents.find(v => v.path === d.path)?.version ?? d.version })) } }));
    return project;
  },
  async create(relativePath, imported) {
    relativePath = relativePath.trim().replaceAll('\\', '/').replace(/^\.\//, '');
    if (!get().project) await get().refresh();
    const project = get().project!;
    const probe = await interfaceProtocol.requestEditor('read', { entryPath: project.entryPath, paths: [relativePath] });
    const doc = probe.documents.find(d => d.relativePath === relativePath.replaceAll('\\', '/') || d.path === relativePath);
    if (!doc || doc.version !== 'missing' || get().tabs.some(t => t.path === doc.path)) throw new Error('文件已存在或路径无效');
    set(s => ({ tabs: [...s.tabs, { ...tabFrom({ ...doc, content: '{}\n', error: undefined }), base: '', version: 'missing' }] }));
    if (imported) {
      await get().open(project.entryPath);
      const main = get().tabs.find(t => t.path === project.entryPath)!;
      const imports = readJson(main.content).value.import;
      get().batch({ [main.path]: editJson(main.content, '/import', [...(Array.isArray(imports) ? imports : []), doc.relativePath]), [doc.path]: '{\n  "task": [],\n  "option": {}\n}\n' });
    }
    await get().open(doc.path); return doc.path;
  },
  async rebase(path) {
    const state = get(); if (!state.project) return;
    const project = await interfaceProtocol.requestEditor('read', { entryPath: state.project.entryPath, paths: [path] });
    const doc = project.documents.find(d => d.path === path); if (!doc || doc.version === 'missing') throw new Error('磁盘文件不存在');
    set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, base: doc.content, version: doc.version, conflict: undefined } : t) }));
  },
})));
