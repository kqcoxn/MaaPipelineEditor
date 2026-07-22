import type { ProjectPath } from "./types";

const WINDOWS_DRIVE = /^[A-Za-z]:/;

export function parseProjectPath(value: string): ProjectPath {
  if (!value || value.includes("\\") || value.includes("//")) {
    throw new Error("项目路径必须使用规范的 / 分隔相对路径");
  }
  if (value.startsWith("/") || WINDOWS_DRIVE.test(value)) {
    throw new Error("项目路径不能是绝对路径");
  }
  if (value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("项目路径不能包含空、. 或 .. 段");
  }
  return value as ProjectPath;
}

export function normalizeProjectPath(value: string): ProjectPath {
  return parseProjectPath(value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""));
}

export function projectPathName(path: ProjectPath | string): string {
  return path.split("/").at(-1) ?? "";
}

export function isSameOrDescendantPath(
  path: ProjectPath | string,
  parent: ProjectPath | string,
): boolean {
  return path === parent || path.startsWith(`${parent}/`);
}

export function remapProjectPath(
  path: ProjectPath | string,
  oldPath: ProjectPath | string,
  newPath: ProjectPath | string,
  isDirectory: boolean,
): ProjectPath {
  const normalizedPath = normalizeProjectPath(path);
  const normalizedOld = normalizeProjectPath(oldPath);
  const normalizedNew = normalizeProjectPath(newPath);
  if (normalizedPath === normalizedOld) return normalizedNew;
  if (isDirectory && normalizedPath.startsWith(`${normalizedOld}/`)) {
    return parseProjectPath(
      `${normalizedNew}${normalizedPath.slice(normalizedOld.length)}`,
    );
  }
  return normalizedPath;
}

export function validateProjectEntryName(name: string): string {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("项目条目名称必须是非空的单个路径段");
  }
  parseProjectPath(name);
  return name;
}

export function joinProjectPath(directory: string, name: string): ProjectPath {
  validateProjectEntryName(name);
  return parseProjectPath(
    directory ? `${parseProjectPath(directory)}/${name}` : name,
  );
}
