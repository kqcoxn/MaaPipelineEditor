import { readJson } from '@/features/pi-editor/json';
import { useProjectInterfaceStore } from '@/features/project-interface/projectInterfaceStore';
import type { PiProject } from '@/features/pi-editor/types';

// Redact at the model/event boundary, including raw source and diagnostic strings.
export function redactPi<T>(value: T, project: PiProject): T {
  const secrets = new Set<string>();
  const fields = new Map<string, Set<string>>();
  const documents = project.documents.map(d => readJson(d.content).value);
  for (const doc of documents) {
    const options = doc.option as Record<string, { inputs?: Array<{ name: string; password?: boolean; default?: unknown }> }> | undefined;
    for (const [name, option] of Object.entries(options ?? {})) for (const field of option.inputs ?? []) if (field.password) {
      const names = fields.get(name) ?? new Set<string>(); names.add(field.name); fields.set(name, names);
      if (typeof field.default === 'string' && field.default) secrets.add(field.default);
    }
  }
  const gather = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    for (const [key, child] of Object.entries(v)) {
      const names = fields.get(key);
      if (names && child && typeof child === 'object') for (const name of names) {
        const secret = (child as Record<string, unknown>)[name];
        if (typeof secret === 'string' && secret) secrets.add(secret);
      }
      gather(child);
    }
  };
  documents.forEach(gather); gather(useProjectInterfaceStore.getState().preferences.values); gather(value);
  const scrub = (v: unknown): unknown => {
    if (typeof v === 'string') { for (const secret of [...secrets].sort((a,b) => b.length-a.length)) v = (v as string).split(secret).join('[已脱敏]'); return v; }
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, child]) => [k, scrub(child)]));
    return v;
  };
  return scrub(value) as T;
}
