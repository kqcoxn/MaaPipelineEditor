import type { WorkspaceTreeEntry } from "../../stores/workspaceStore";
import type { WorkspaceDocument } from "../../services/generated/bridge-v2";
import type { Key } from "react";

export const PROJECT_TREE_ROOT_KEY = "__mpe_workspace_root__";
export const PROJECT_TREE_CREATE_KEY = "__mpe_create_file__";

export type ProjectTreeNodeKind = "root" | "directory" | "file" | "draft";

export interface ProjectTreeNode {
  key: string;
  title: string;
  path: string;
  kind: ProjectTreeNodeKind;
  selectable: boolean;
  document?: WorkspaceDocument;
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
  capabilities: Iterable<string | WorkspaceDocument>,
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
  const capabilityList = Array.from(capabilities);
  const documentMap = new Map<string, WorkspaceDocument>();
  const pipelineSet = new Set<string>();
  capabilityList.forEach((item) => {
    if (typeof item === "string") {
      pipelineSet.add(normalizePath(item));
    } else {
      documentMap.set(normalizePath(item.path), item);
    }
  });

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
    const document = documentMap.get(path);
    parent.children?.push({
      key: path,
      title: entry.name || segments.at(-1) || path,
      path,
      kind: "file",
      selectable: document ? true : pipelineSet.has(path),
      document,
      isLeaf: true,
    });
  });

  sortChildren(rootNode);
  return rootNode;
}

export function withCreateFileDraft(
  root: ProjectTreeNode,
  directoryPath: string,
): ProjectTreeNode {
  const targetPath = normalizePath(directoryPath);
  const visit = (node: ProjectTreeNode): ProjectTreeNode => {
    const children = node.children?.map(visit);
    if (node.path !== targetPath || node.kind === "file") {
      return children ? { ...node, children } : { ...node };
    }

    const draft: ProjectTreeNode = {
      key: `${PROJECT_TREE_CREATE_KEY}:${targetPath || "."}`,
      title: "",
      path: targetPath,
      kind: "draft",
      selectable: false,
      isLeaf: true,
    };
    return {
      ...node,
      children: [draft, ...(children ?? [])],
    };
  };

  return visit(root);
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
  capabilities: Iterable<string | WorkspaceDocument>,
): string[] {
  if (!currentFilePath) return [];
  const normalized = normalizePath(currentFilePath);
  const list = Array.from(capabilities);
  const selectable = list.some((item) =>
    typeof item === "string"
      ? normalizePath(item) === normalized
      : normalizePath(item.path) === normalized,
  );
  return selectable ? [normalized] : [];
}
