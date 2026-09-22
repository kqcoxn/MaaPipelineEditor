import { usePiEditorStore as store } from './store';
import { editJson, escapePointer, insertRaw, rawAt, readJson, renameKey, valueAt } from './json';
import type { PiIndexItem } from './types';

export async function editDefinition(kind: string, name: string) {
  await store.getState().refresh();
  const project = await store.getState().validate() ?? store.getState().project;
  const definition = project?.definitions.find(d => d.kind === kind && d.name === name && d.effective);
  if (!definition) throw new Error('找不到定义位置');
  await store.getState().open(definition.file, definition.pointer);
}
export async function renameDefinition(def: PiIndexItem, name: string) {
  if (!name.trim() || name === def.name) return;
  const project = await store.getState().validate();
  if (!project) throw new Error('请先修复源码');
  if (project.definitions.some(d => d.kind === def.kind && d.name === name)) throw new Error('名称已存在');
  if (def.kind === 'option' && project.definitions.filter(d => d.kind === 'option' && d.name === def.name && d.effective).some(d => d.file !== def.file)) throw new Error('当前定义被覆盖，请先跳转到生效定义');
  if (def.kind === 'option' && project.definitions.filter(d => d.kind === 'option' && d.name === def.name).length > 1) throw new Error('同名选项存在多个定义，请通过源码明确调整覆盖关系后重命名');
  const refs = project.references.filter(r => r.kind === def.kind && r.name === def.name && (def.kind !== 'translation' || r.effective));
  const translationDefs = def.kind === 'translation' ? project.definitions.filter(d => d.kind === 'translation' && d.name === def.name) : [];
  const paths = new Set([def.file, ...refs.map(r => r.file), ...translationDefs.map(d => d.file)]);
  const contents: Record<string, string> = {};
  for (const path of paths) { await store.getState().open(path); contents[path] = store.getState().tabs.find(t => t.path === path)!.content; }
  for (const ref of refs) {
    if (def.kind === 'option' && !Array.isArray(valueAt(contents[ref.file], ref.pointer.slice(0, ref.pointer.lastIndexOf('/'))))) contents[ref.file] = renameKey(contents[ref.file], ref.pointer, name);
    else contents[ref.file] = editJson(contents[ref.file], ref.pointer, def.kind === 'translation' ? '$' + name : name);
  }
  if (def.kind === 'translation') for (const d of translationDefs) contents[d.file] = renameKey(contents[d.file], d.pointer, name);
  else contents[def.file] = def.kind === 'option' ? renameKey(contents[def.file], def.pointer, name) : editJson(contents[def.file], def.pointer + '/name', name);
  store.getState().batch(contents);
  await store.getState().open(def.file, def.kind === 'option' ? '/option/' + escapePointer(name) : def.kind === 'translation' ? '/' + escapePointer(name) : def.pointer);
}
export async function deleteDefinition(def: PiIndexItem) {
  const project = await store.getState().validate(); if (!project) throw new Error('请先修复源码');
  const refs = project.references.filter(r => r.kind === def.kind && r.name === def.name && !(r.file === def.file && r.pointer.startsWith(def.pointer + '/')));
  if (refs.length) throw new Error(`请先解除 ${refs.length} 处引用：${refs.map(r => `${r.file} ${r.pointer}`).join('；')}`);
  store.getState().patch(def.file, def.pointer, undefined); store.getState().select(def.file, '');
}
export async function copyDefinition(def: PiIndexItem, name: string): Promise<string> {
  const tab = store.getState().tabs.find(t => t.path === def.file)!;
  const data = readJson(tab.content).value;
  const definitions = store.getState().project?.definitions ?? [];
  if (!name.trim() || definitions.some(d => d.kind === def.kind && d.name === name)) throw new Error('名称为空或已存在');
  if (def.kind === 'option' || def.kind === 'translation') {
    const pointer = def.kind === 'option' ? '/option/' + escapePointer(name) : '/' + escapePointer(name);
    store.getState().update(tab.path, insertRaw(tab.content, pointer, rawAt(tab.content, def.pointer)));
    store.getState().select(tab.path, pointer); return pointer;
  }
  const items = Array.isArray(data[def.kind]) ? data[def.kind] as unknown[] : [];
  const pointer = `/${def.kind}/${items.length}`;
  let content = insertRaw(tab.content, pointer, rawAt(tab.content, def.pointer));
  content = editJson(content, pointer + '/name', name);
  store.getState().update(tab.path, content); store.getState().select(tab.path, pointer); return pointer;
}
export async function moveDefinition(def: PiIndexItem, target: string, withOptions: boolean) {
  if (target === def.file) throw new Error('请选择其他文件');
  const project = await store.getState().validate(); if (!project) throw new Error('请先修复源码');
  await store.getState().open(target);
  const source = store.getState().tabs.find(t => t.path === def.file)!;
  const dest = store.getState().tabs.find(t => t.path === target)!;
  if (dest.kind === 'language') throw new Error('不能移入语言文件');
  let sourceContent = source.content, destContent = dest.content;
  const targetData = readJson(destContent).value;
  let targetPointer = def.pointer;
  if (def.kind === 'option') {
    if (valueAt(destContent, def.pointer) !== undefined) throw new Error('目标文件存在同名选项');
  } else targetPointer = '/' + def.kind + '/' + (Array.isArray(targetData[def.kind]) ? (targetData[def.kind] as unknown[]).length : 0);
  const moving = new Set<string>();
  const include = (name: string) => {
    if (moving.has(name)) return; moving.add(name);
    const item = project.definitions.find(d => d.kind === 'option' && d.name === name && d.effective);
    if (!item || item.file !== def.file) throw new Error(`选项 ${name} 不在当前文件，请单独处理`);
    for (const r of project.references.filter(r => r.kind === 'option' && r.file === def.file && r.pointer.startsWith(item.pointer + '/'))) include(r.name);
  };
  if (withOptions && def.kind === 'task') for (const r of project.references.filter(r => r.kind === 'option' && r.file === def.file && r.pointer.startsWith(def.pointer + '/'))) include(r.name);
  for (const name of moving) {
    const refs = project.references.filter(r => r.kind === 'option' && r.name === name);
    if (refs.some(r => r.file !== def.file || (!r.pointer.startsWith(def.pointer + '/') && ![...moving].some(n => r.pointer.startsWith('/option/' + escapePointer(n) + '/'))))) throw new Error(`选项 ${name} 有外部引用，不能随任务移动`);
    const p = '/option/' + escapePointer(name);
    if (valueAt(destContent, p) !== undefined) throw new Error(`目标文件已存在 ${name}`);
    destContent = insertRaw(destContent, p, rawAt(sourceContent, p)); sourceContent = editJson(sourceContent, p, undefined);
  }
  destContent = insertRaw(destContent, targetPointer, rawAt(sourceContent, def.pointer));
  sourceContent = editJson(sourceContent, def.pointer, undefined);
  store.getState().batch({ [source.path]: sourceContent, [dest.path]: destContent });
  await store.getState().open(dest.path, targetPointer);
}
export async function addTask(path: string, name: string, entry: string) {
  await store.getState().open(path);
  const tab = store.getState().tabs.find(t => t.path === path)!;
  if (tab.kind === 'language') throw new Error('不能在语言文件中创建任务');
  if (!name.trim() || store.getState().project?.definitions.some(d => d.kind === 'task' && d.name === name)) throw new Error('任务名称为空或已存在');
  const tasks = readJson(tab.content).value.task;
  const pointer = '/task/' + (Array.isArray(tasks) ? tasks.length : 0);
  store.getState().patch(path, pointer, { name, entry }); store.getState().select(path, pointer);
}
