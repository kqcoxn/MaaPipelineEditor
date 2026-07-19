import type { WorkspaceTreeEntry } from "../../stores/workspaceStore";
import type { Key } from "react";

export const PROJECT_TREE_ROOT_KEY = "__mpe_workspace_root__";

export type ProjectTreeNodeKind = "root" | "directory" | "file";

export interface ProjectTreeNode {
  key: string;
  title: string;
  path: string;
  kind: ProjectTreeNodeKind;
  selectable: boolean;
  isLeaf?: boolean;
  children?: ProjectTreeNode[];
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function compareNodes(left: ProjectTreeNode, right: ProjectTreeNode): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }
  const insensitive = left.title.localeCompare(right.title, undefined, {
    sensitivity: "base",
    numeric: true,
  });
  return insensitive || left.title.localeCompare(right.title);
}

function sortChildren(node: ProjectTreeNode): void {
  node.children?.sort(compareNodes);
  node.children?.forEach(sortChildren);
}

function ensureDirectory(
  root: ProjectTreeNode,
  directories: Map<string, ProjectTreeNode>,
  path: string,
  displayName?: string,
): ProjectTreeNode {
  const normalized = normalizePath(path);
  const existing = directories.get(normalized);
  if (existing) return existing;

  const segments = normalized.split("/");
  let parent = root;
  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    let child = directories.get(currentPath);
    if (!child) {
      child = {
        key: currentPath,
        title:
          index === segments.length - 1 && displayName
            ? displayName
            : segment,
        path: currentPath,
        kind: "directory",
        selectable: false,
        children: [],
      };
      directories.set(currentPath, child);
      parent.children?.push(child);
    }
    parent = child;
  });
  return parent;
}

export function getWorkspaceRootName(root: string): string {
  const normalized = root.replace(/[\\/]+$/, "");
  const name = normalized.split(/[\\/]/).pop();
  return name || normalized || "项目树";
}

export function buildProjectTree(
  root: string,
  entries: WorkspaceTreeEntry[],
  pipelinePaths: Iterable<string>,
): ProjectTreeNode {
  const rootNode: ProjectTreeNode = {
    key: PROJECT_TREE_ROOT_KEY,
    title: getWorkspaceRootName(root),
    path: "",
    kind: "root",
    selectable: false,
    children: [],
  };
  const directories = new Map<string, ProjectTreeNode>();
  const pipelineSet = new Set(
    Array.from(pipelinePaths, (path) => normalizePath(path)),
  );

  entries.forEach((entry) => {
    const path = normalizePath(entry.path);
    if (!path) return;
    if (entry.kind === "directory") {
      ensureDirectory(rootNode, directories, path, entry.name);
      return;
    }

    const segments = path.split("/");
    const parentPath = segments.slice(0, -1).join("/");
    const parent = parentPath
      ? ensureDirectory(rootNode, directories, parentPath)
      : rootNode;
    if (parent.children?.some((child) => child.path === path)) return;
    parent.children?.push({
      key: path,
      title: entry.name || segments.at(-1) || path,
      path,
      kind: "file",
      selectable: pipelineSet.has(path),
      isLeaf: true,
    });
  });

  sortChildren(rootNode);
  return rootNode;
}

export function preserveExpandedProjectTreeKeys(
  expandedKeys: Iterable<Key>,
  root: ProjectTreeNode,
): string[] {
  const validDirectories = new Set<string>([PROJECT_TREE_ROOT_KEY]);
  const collect = (node: ProjectTreeNode) => {
    if (node.kind === "directory") validDirectories.add(node.key);
    node.children?.forEach(collect);
  };
  root.children?.forEach(collect);
  return Array.from(expandedKeys, String).filter((key) =>
    validDirectories.has(key),
  );
}

export function getSelectedProjectTreeKeys(
  currentFilePath: string | undefined,
  pipelinePaths: Iterable<string>,
): string[] {
  if (!currentFilePath) return [];
  const normalized = normalizePath(currentFilePath);
  return Array.from(pipelinePaths, normalizePath).includes(normalized)
    ? [normalized]
    : [];
}
