export function entryPathLabel(path: string, root: string): string {
  const normalized = path.replace(/\\/g, "/");
  const prefix = root.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  const windows = /^[a-z]:\//i.test(prefix) || prefix.startsWith("//");
  const inside = windows ? normalized.toLowerCase().startsWith(prefix.toLowerCase()) : normalized.startsWith(prefix);
  return root && inside ? normalized.slice(prefix.length) : normalized;
}
