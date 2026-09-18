/** For display only. Keep the original path for identity and filesystem operations. */
export function displayPath(path: string): string {
  if (/^\\\\\?\\UNC\\/i.test(path)) return "\\\\" + path.slice(8);
  if (/^\\\\\?\\[a-z]:\\/i.test(path)) return path.slice(4);
  return path;
}
