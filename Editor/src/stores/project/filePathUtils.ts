/**
 * 仅用于路径比较，不改变实际传给 LocalBridge 的路径格式。
 * Windows 路径大小写不敏感，且前端与后端可能使用不同的分隔符。
 */
export function normalizeFilePath(filePath?: string): string {
  if (typeof filePath !== "string") return "";

  const normalized = filePath.trim().replace(/[\\/]+/g, "/");
  if (!normalized) return "";
  if (normalized === "/") return "/";

  // 保留盘符根目录的语义：C:\\ 与 C: 归一化为同一个比较值。
  if (/^[a-zA-Z]:\/?$/.test(normalized)) {
    return normalized.slice(0, 2).toLowerCase();
  }

  return normalized.replace(/\/+$/, "").toLowerCase();
}

export function areFilePathsEqual(
  leftPath?: string,
  rightPath?: string,
): boolean {
  const left = normalizeFilePath(leftPath);
  const right = normalizeFilePath(rightPath);
  return Boolean(left && right && left === right);
}

/** 判断 filePath 是否位于 rootPath 内（包含 rootPath 本身）。 */
export function isFilePathWithinRoot(
  filePath?: string,
  rootPath?: string,
): boolean {
  const file = normalizeFilePath(filePath);
  const root = normalizeFilePath(rootPath);
  if (!file || !root) return false;
  if (root === "/") return file.startsWith("/");
  return file === root || file.startsWith(`${root}/`);
}
