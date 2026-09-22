import { editJson, valueAt, readJson, renameKey, reorderJson, insertRaw, escapePointer } from '@/features/pi-editor/json';
import type { PiProject } from '@/features/pi-editor/types';
import type { PiOperation } from './types';

// Even when the model supplies a whole object, modify only changed leaf spans.
function setLocal(content: string, pointer: string, value: unknown): string {
  const old = valueAt(content, pointer);
  if (JSON.stringify(old) === JSON.stringify(value)) return content;
  if (Array.isArray(old) && Array.isArray(value)) {
    for (let i = old.length - 1; i >= value.length; i--) content = editJson(content, `${pointer}/${i}`, undefined);
    for (let i = 0; i < value.length; i++) content = setLocal(content, `${pointer}/${i}`, value[i]);
    return content;
  }
  if (old && value && typeof old === 'object' && typeof value === 'object' && !Array.isArray(old) && !Array.isArray(value)) {
    const before = old as Record<string, unknown>, after = value as Record<string, unknown>;
    for (const key of Object.keys(before)) if (!(key in after)) content = editJson(content, pointer + '/' + escapePointer(key), undefined);
    for (const [key, item] of Object.entries(after)) content = setLocal(content, pointer + '/' + escapePointer(key), item);
    return content;
  }
  return editJson(content, pointer, value);
}

export function buildPiChanges(project: PiProject, operations: PiOperation[]): Record<string, string> {
  const contents = Object.fromEntries(project.documents.map(d => [d.path, d.content]));
  for (const op of operations) {
    if (!(op.file in contents)) throw new Error('只能修改当前 PI 项目的已读取文档');
    if (!op.pointer.startsWith('/') || /~(?![01])/.test(op.pointer)) throw new Error('必须指定有效 JSON Pointer，不能替换文件根值');
    const content = contents[op.file];
    if (readJson(content).error) throw new Error('请先修复无效 JSONC 草稿');
    const old = valueAt(content, op.pointer);
    switch (op.type) {
      case 'set':
        if (op.value === undefined) throw new Error('set 缺少 value');
        contents[op.file] = setLocal(content, op.pointer, op.value); break;
      case 'remove':
        if (old === undefined) throw new Error('待删除字段不存在');
        contents[op.file] = editJson(content, op.pointer, undefined); break;
      case 'insert': {
        if (!Array.isArray(old) || op.index === undefined || op.index < 0 || op.index > old.length || op.value === undefined) throw new Error('数组插入位置无效');
        // Shift raw array values rather than serializing existing definitions.
        let text = insertRaw(content, `${op.pointer}/${old.length}`, JSON.stringify(op.value));
        if (op.index !== old.length) text = reorderJson(text, op.pointer, old.length, op.index);
        contents[op.file] = text; break;
      }
      case 'move':
        if (!Array.isArray(old) || op.index === undefined || op.to === undefined || op.index >= old.length || op.to >= old.length) throw new Error('数组移动位置无效');
        contents[op.file] = reorderJson(content, op.pointer, op.index, op.to); break;
      case 'rename': {
        const def = project.definitions.find(d => d.file === op.file && d.pointer === op.pointer);
        if (!def || !op.name?.trim()) throw new Error('无法定位定义或新名称为空');
        if (project.definitions.some(d => d.kind === def.kind && d.name === op.name)) throw new Error('名称冲突');
        if (def.kind !== 'translation' && project.definitions.filter(d => d.kind === def.kind && d.name === def.name).length !== 1) throw new Error('同名定义有歧义，请明确调整源码');
        const refs = project.references.filter(r => r.kind === def.kind && r.name === def.name);
        for (const ref of refs) {
          const parent = valueAt(contents[ref.file], ref.pointer.slice(0, ref.pointer.lastIndexOf('/')));
          contents[ref.file] = def.kind === 'option' && !Array.isArray(parent) ? renameKey(contents[ref.file], ref.pointer, op.name) : editJson(contents[ref.file], ref.pointer, def.kind === 'translation' ? '$' + op.name : op.name);
        }
        const definitions = def.kind === 'translation' ? project.definitions.filter(d => d.kind === def.kind && d.name === def.name) : [def];
        for (const d of definitions) contents[d.file] = ['option', 'translation'].includes(d.kind) ? renameKey(contents[d.file], d.pointer, op.name) : editJson(contents[d.file], d.pointer + '/name', op.name);
        // Re-index before further identity-based operations; mixed rename batches would use stale pointers.
        if (operations.length !== 1) throw new Error('定义改名请作为独立方案生成，其他修改后重新查询');
        break;
      }
    }
  }
  // Removing a definition must not leave references. The backend re-indexes all other changes.
  for (const d of project.definitions) {
    const data = readJson(contents[d.file]).value;
    const exists = d.kind === 'option' ? (data.option as Record<string, unknown> | undefined)?.[d.name] !== undefined : d.kind === 'translation' ? data[d.name] !== undefined : Array.isArray(data[d.kind]) && (data[d.kind] as Array<{ name: string }>).some(v => v.name === d.name);
    if (!exists && !operations.some(op => op.type === 'rename')) {
      for (const r of project.references.filter(r => r.kind === d.kind && r.name === d.name)) {
        const v = valueAt(contents[r.file], r.pointer);
        if (v === d.name || v === '$' + d.name || r.pointer.endsWith('/' + escapePointer(d.name)) && v !== undefined) throw new Error(`请先解除引用：${r.file} ${r.pointer}`);
      }
    }
  }
  return Object.fromEntries(Object.entries(contents).filter(([path, value]) => project.documents.find(d => d.path === path)?.content !== value));
}
