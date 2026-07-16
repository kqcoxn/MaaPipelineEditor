import type { LocalFileInfo } from "../../stores/localFileStore";

const FOLDER_FILTER_SEPARATOR = /[,;；\r\n]+/;

function normalizePathSegment(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function parseFolderFilter(filterText: string): string[] {
  return filterText
    .split(FOLDER_FILTER_SEPARATOR)
    .map(normalizePathSegment)
    .filter(Boolean);
}

export function matchesFolderFilter(
  relativePath: string,
  filterText: string,
): boolean {
  const folders = parseFolderFilter(filterText);
  if (folders.length === 0) return true;

  const normalizedPath = normalizePathSegment(relativePath);
  return folders.some((folder) => normalizedPath.startsWith(`${folder}/`));
}

export function filterLocalFilesByFolderFilter(
  files: LocalFileInfo[],
  filterText: string,
): LocalFileInfo[] {
  const folders = parseFolderFilter(filterText);
  if (folders.length === 0) return files;

  return files.filter((file) => {
    const normalizedPath = normalizePathSegment(file.relative_path);
    return folders.some((folder) => normalizedPath.startsWith(`${folder}/`));
  });
}
