export function normalizeProjectPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

export function isSameOrDescendantPath(
  path: string,
  parentPath: string,
): boolean {
  const normalizedPath = normalizeProjectPath(path);
  const normalizedParent = normalizeProjectPath(parentPath);
  return (
    normalizedPath === normalizedParent ||
    normalizedPath.startsWith(`${normalizedParent}/`)
  );
}

export function remapProjectPath(
  path: string,
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
): string {
  const normalizedPath = normalizeProjectPath(path);
  const normalizedOld = normalizeProjectPath(oldPath);
  const normalizedNew = normalizeProjectPath(newPath);
  if (normalizedPath === normalizedOld) return normalizedNew;
  if (isDirectory && normalizedPath.startsWith(`${normalizedOld}/`)) {
    return `${normalizedNew}${normalizedPath.slice(normalizedOld.length)}`;
  }
  return normalizedPath;
}

export function projectPathName(path: string): string {
  return normalizeProjectPath(path).split("/").pop() ?? "";
}
