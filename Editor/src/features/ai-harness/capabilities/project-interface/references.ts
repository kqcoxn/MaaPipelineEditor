import { valueAt } from '@/features/pi-editor/json';
import type { PiQueryResult } from './types';

export function piReferences(r: PiQueryResult, name: string, kind = 'option', taskName?: string) {
  const references: unknown[] = [];
  const coveredNodes: unknown[] = [];
  const visit = (target: string, targetKind: string, chain: string[], seen: Set<string>) => {
    if (seen.has(targetKind + ':' + target)) return;
    const next = new Set(seen).add(targetKind + ':' + target);
    for (const ref of r.project.references.filter(ref => ref.kind === targetKind && ref.name === target)) {
      const owner = r.project.definitions.filter(d => d.file === ref.file && ref.pointer.startsWith(d.pointer + '/')).sort((a,b) => b.pointer.length-a.pointer.length)[0];
      let applicable: boolean | undefined;
      if (r.events && owner) {
        const branch = ref.pointer.match(/^(.*\/cases\/\d+)\//)?.[1];
        if (owner.kind === 'option') applicable = r.events.some(e => e.file === owner.file && e.option === owner.name && e.active && (!branch || e.pointer === branch || e.pointer.startsWith(branch + '/')));
        if (owner.kind === 'task') applicable = owner.name === taskName && (targetKind !== 'option' || r.events.some(e => e.scope === 'task' && e.option === target && e.active));
      }
      references.push({ ...ref, version: r.versions[ref.file], chain, applicable, relation: '静态引用', dynamic: ref.name.includes('[') || ref.name.includes('{') });
      if (owner?.kind === 'option') visit(owner.name, 'option', [...chain, owner.name], next);
    }
  };
  visit(name, kind, [name], new Set());
  const cover = (optionName: string, chain: string[], seen: Set<string>) => {
    if (seen.has(optionName)) return;
    const next = new Set(seen).add(optionName);
    for (const def of r.project.definitions.filter(d => d.kind === 'option' && d.name === optionName)) {
      for (const ref of r.project.references.filter(ref => ref.kind === 'pipeline' && ref.file === def.file && ref.pointer.startsWith(def.pointer + '/'))) coveredNodes.push({ ...ref, chain, version: r.versions[ref.file], dynamic: ref.name.includes('[') || ref.name.includes('{') });
      const doc = r.project.documents.find(d => d.path === def.file)!;
      const raw = valueAt(doc.content, def.pointer) as { option?: string[]; cases?: Array<{ option?: string[] }> };
      for (const child of [...(raw.option ?? []), ...(raw.cases ?? []).flatMap(c => c.option ?? [])]) cover(child, [...chain,child], next);
    }
  };
  if (kind === 'option') cover(name, [name], new Set());
  return { references, coveredNodes };
}
