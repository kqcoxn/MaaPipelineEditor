import { useState } from 'react';

type Row = { key: string; content: string; id: string };
type Identity = { scope: string; signature: string; rows: Row[]; next: number };

// JSON objects are reparsed on every edit. Keep UI identity outside the document:
// unchanged rows follow reorders, while an edited row retains its mounted form.
function reconcile(previous: Identity, scope: string, signature: string, values: Omit<Row, 'id'>[]): Identity {
  const old = previous.scope === scope ? previous.rows : [];
  const used = new Set<number>();
  const matches = new Map<number, number>();
  const match = (index: number, candidate: number) => {
    if (candidate < 0) return;
    used.add(candidate);
    matches.set(index, candidate);
  };
  // Reserve unchanged positions first, including duplicate or temporarily empty names.
  values.forEach((value, index) => {
    if (old[index]?.content === value.content) match(index, index);
  });
  for (const field of ['content', 'key'] as const) {
    values.forEach((value, index) => {
      if (!matches.has(index)) match(index, old.findIndex((row, i) => !used.has(i) && row[field] === value[field]));
    });
  }
  if (old.length === values.length) {
    values.forEach((_value, index) => {
      if (!matches.has(index) && !used.has(index)) match(index, index);
    });
  }
  let next = previous.next;
  const rows = values.map((value, index) => {
    const matchIndex = matches.get(index);
    return { ...value, id: matchIndex === undefined ? `pi-row-${next++}` : old[matchIndex].id };
  });
  return { scope, signature, rows, next };
}

export function usePiRowIds<T>(scope: string, items: T[], itemKey: (item: T) => string): string[] {
  const values = items.map(item => ({ key: itemKey(item), content: JSON.stringify(item) ?? '' }));
  const signature = JSON.stringify(values);
  const [identity, setIdentity] = useState<Identity>(() => reconcile({ scope, signature: '', rows: [], next: 0 }, scope, signature, values));
  if (identity.scope !== scope || identity.signature !== signature) {
    const next = reconcile(identity, scope, signature, values);
    setIdentity(next);
    return next.rows.map(row => row.id);
  }
  return identity.rows.map(row => row.id);
}
