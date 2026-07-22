import { create } from "zustand";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { notification } from "antd";

import { useFlowStore, type NodeType, type EdgeType } from "./flow";
import {
  restoreConfigCache,
  saveConfigCache,
} from "./configStore";
import { normalizeViewport } from "./flow/utils/viewportUtils";
import { pipelineToFlow } from "../core/parser";
import type { CoordinateMode } from "./flow/utils/coordinateUtils";
import {
  normalizeProjectPath,
  projectPathName,
  remapProjectPath,
} from "../utils/projectPath";
import {
  asDocumentId,
  type DocumentId,
} from "../features/project-session/types";
import { useProjectSessionStore } from "./projectSessionStore";

export type FileConfigType = {
  prefix: string;
  coordinateMode?: CoordinateMode;
  filePath?: string;
  relativePath?: string;
  separatedConfigPath?: string;
  lastSyncTime?: number;
  savedViewport?: { x: number; y: number; zoom: number };
  // 节点顺序管理
  nodeOrderMap?: Record<string, number>;
  nextOrderNumber?: number;
};
export type FileType = {
  documentId: DocumentId;
  fileName: string;
  nodes: NodeType[];
  edges: EdgeType[];
  config: FileConfigType;
};

/**辅助函数 */
function findFileIndex(fileName: string): number {
  return useFileStore
    .getState()
    .files.findIndex((file) => file.fileName === fileName);
}
// 检测文件名是否重复
function isFileNameRepate(fileName: string, isSelf = true): boolean {
  try {
    if (!isSelf) return findFileIndex(fileName) >= 0;
    const state = useFileStore.getState();
    const index = findFileIndex(state.currentFile.fileName);
    let isRepate = false;
    state.files.forEach((file, i) => {
      if (file.fileName === fileName && i !== index) {
        isRepate = true;
        return;
      }
    });
    return isRepate;
  } catch {
    return false;
  }
}
// 创建空文件
let fileIdCounter = 1;
function createFile(options?: {
  fileName?: string;
  config?: Partial<FileConfigType>;
  documentId?: DocumentId;
}): FileType {
  let { fileName = "新建Pipeline" + fileIdCounter++ } = options || {};
  const {
    config,
    documentId = asDocumentId(`draft:${crypto.randomUUID()}`),
  } = options || {};
  while (isFileNameRepate(fileName, false)) {
    fileName = "新建Pipeline" + fileIdCounter++;
  }
  return {
    documentId,
    fileName,
    nodes: [],
    edges: [],
    config: { prefix: "", ...config },
  };
}
const initialFile = createFile();

/** 同步 FlowStore 数据到 FileStore.currentFile 和 files 数组 */
function syncFlowStoreToFileStore(
  additionalConfig?: Partial<FileConfigType>,
): void {
  const flowStore = useFlowStore.getState();
  useFileStore.setState((state) => {
    const nodes = flowStore.nodes.map((node: NodeType) => ({
      ...node,
      selected: undefined,
    }));
    const edges = flowStore.edges.map((edge: EdgeType) => ({
      ...edge,
      selected: undefined,
    }));
    const nextFile = {
      ...state.currentFile,
      nodes,
      edges,
      config: { ...state.currentFile.config, ...additionalConfig },
    };
    const fileIndex = state.files.findIndex(
      (file) => file.documentId === nextFile.documentId,
    );
    if (fileIndex >= 0) {
      state.files = state.files.map((file, index) =>
        index === fileIndex ? nextFile : file,
      );
    }
    return { currentFile: nextFile };
  });
}

function normalizeFileProjection(file: FileType): FileType {
  return file;
}

function normalizeCachedFile(file: Omit<FileType, "documentId"> & {
  documentId?: DocumentId;
}): FileType {
  const normalized = {
    ...file,
    documentId: file.documentId ?? asDocumentId(`draft:${crypto.randomUUID()}`),
    config: {
      prefix: "",
      ...file.config,
      filePath: undefined,
      relativePath: undefined,
      separatedConfigPath: undefined,
      lastSyncTime: undefined,
    },
  } as FileType;
  return normalized;
}

// 保存Flow
export function saveFlow(): FileType | null {
  try {
    const fileState = useFileStore.getState();
    if (
      !fileState.files.some(
        (file) => file.documentId === fileState.currentFile.documentId,
      )
    ) {
      console.error("[fileStore] saveFlow: 当前文件不在 files 数组中");
      return null;
    }
    const flowState = useFlowStore.getState();
    fileState.syncCurrentGraph(flowState.nodes, flowState.edges);
    return useFileStore.getState().currentFile;
  } catch (err) {
    console.error("[fileStore] saveFlow 失败:", err);
    return null;
  }
}
// 本地存储
export function localSave(): { success: boolean; error?: string } {
  if (!saveFlow()) {
    console.warn("[fileStore] localSave: 页面未初始化结束");
    return { success: false, error: "页面未初始化结束" };
  }
  try {
    const fileState = useFileStore.getState();
    const filesToSave = fileState.files.map((file) => ({
      ...file,
      config: {
        ...file.config,
        nodeOrderMap: undefined,
        nextOrderNumber: undefined,
        // 对 savedViewport 的值取整
        savedViewport: normalizeViewport(file.config.savedViewport),
      },
    }));
    localStorage.setItem("_mpe_files", JSON.stringify(filesToSave));

    saveConfigCache();

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[fileStore] localSave 失败:", errorMsg);

    // 检测是否是 localStorage 配额超限
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      notification.error({
        title: "本地存储空间不足",
        description:
          "浏览器本地存储空间已满，无法保存文件缓存。建议清理本域名在浏览器中的数据或减少文件数量。",
        placement: "topRight",
        duration: 10,
      });
    }

    return { success: false, error: errorMsg };
  }
}

// 分配新的顺序号
export function assignNodeOrder(nodeId: string): number {
  const state = useFileStore.getState();
  const config = state.currentFile.config;
  const orderMap = { ...(config.nodeOrderMap ?? {}) };
  const nextOrder = config.nextOrderNumber ?? 0;

  orderMap[nodeId] = nextOrder;
  useFileStore.getState().setFileConfig("nodeOrderMap", orderMap);
  useFileStore.getState().setFileConfig("nextOrderNumber", nextOrder + 1);

  return nextOrder;
}

// 移除节点顺序
export function removeNodeOrder(nodeId: string): void {
  const state = useFileStore.getState();
  const orderMap = { ...(state.currentFile.config.nodeOrderMap ?? {}) };
  delete orderMap[nodeId];
  useFileStore.getState().setFileConfig("nodeOrderMap", orderMap);
}

// 获取节点顺序
export function getNodeOrder(nodeId: string): number | undefined {
  const state = useFileStore.getState();
  return state.currentFile.config.nodeOrderMap?.[nodeId];
}

/**文件仓库 */
type FileState = {
  files: FileType[];
  currentFile: FileType;
  setFileName: (fileName: string) => boolean;
  setFileConfig: <K extends keyof FileConfigType>(
    key: K,
    value: FileConfigType[K],
  ) => void;
  syncCurrentGraph: (nodes: NodeType[], edges: EdgeType[]) => void;
  switchFile: (fileName: string) => string | null;
  switchDocument: (documentId: DocumentId) => DocumentId | null;
  addFile: (options?: { isSwitch: boolean }) => string | null;
  removeFile: (fileName: string) => string | null;
  removeDocument: (documentId: DocumentId) => DocumentId | null;
  onDragEnd: (result: DragEndEvent) => void;
  replace: (files?: FileType[]) => any;
  resetProjectSession: () => void;
  clearProjectFiles: () => void;
  // 本地文件操作方法
  openFileFromLocal: (
    filePath: string,
    content: any,
    mpeConfig?: any,
    configPath?: string,
    documentId?: DocumentId,
  ) => Promise<boolean>;
  findFileByPath: (filePath: string) => FileType | undefined;
  findFileByDocumentId: (documentId: DocumentId) => FileType | undefined;
  applyDocumentIdMappings: (
    mappings: Array<{ oldDocumentId: string; newDocumentId: string }>,
  ) => void;
  renamePath: (oldPath: string, newPath: string, isDirectory: boolean) => void;
};
export const useFileStore = create<FileState>()((set, get) => ({
  files: [],
  currentFile: initialFile,

  // 修改文件名
  setFileName(fileName) {
    // 空文件名
    if (!fileName) return false;
    // 修改名
    let isValid = true;
    set((state) => {
      // 文件名重复
      isValid =
        !state.currentFile.documentId.startsWith("draft:") ||
        !isFileNameRepate(fileName);
      if (!isValid) return {};
      // 修改
      let files = state.files;
      let currentFile = state.currentFile;
      const index = state.files.findIndex(
        (file) => file.documentId === currentFile.documentId,
      );
      currentFile = normalizeFileProjection({ ...state.currentFile, fileName });
      files[index] = currentFile;
      files = [...files];
      return { files, currentFile };
    });
    if (!isValid) {
      notification.warning({
        title: `重复的文件名`,
        description:
          "预检测到目标文件名与现有文件重复，请使用不同的名称命名文件；若仅为中间状态，请先输入后续部分以区分。",
        placement: "topLeft",
      });
    }
    return isValid;
  },

  // 设置文件配置
  setFileConfig(key, value) {
    set((state) => {
      const config = { ...state.currentFile.config, [key]: value };
      const currentFile = normalizeFileProjection({ ...state.currentFile, config });
      const currentFileIndex = state.files.findIndex(
        (file) => file.documentId === currentFile.documentId,
      );
      const files =
        currentFileIndex >= 0
          ? state.files.map((file, index) =>
              index === currentFileIndex ? currentFile : file,
            )
          : state.files;
      state.currentFile = currentFile;
      state.files = files;
      return {};
    });
  },

  syncCurrentGraph(nodes, edges) {
    set((state) => {
      if (!state.files.some((file) => file.documentId === state.currentFile.documentId)) {
        return state;
      }
      const currentFile = normalizeFileProjection({
        ...state.currentFile,
        nodes: nodes.map((node) => ({ ...node, selected: undefined })),
        edges: edges.map((edge) => ({ ...edge, selected: undefined })),
      });
      return {
        currentFile,
        files: state.files.map((file) =>
          file.documentId === currentFile.documentId ? currentFile : file,
        ),
      };
    });
  },

  // 切换文件
  switchFile: (fileName: string) => {
    const state = get();
    const targetFile = state.files.find((file) => file.fileName === fileName);
    if (!targetFile) return null;
    return get().switchDocument(targetFile.documentId) ? targetFile.fileName : null;
  },

  switchDocument: (documentId: DocumentId) => {
    const state = get();
    if (state.currentFile.documentId === documentId) return documentId;
    if (!state.files.some((file) => file.documentId === documentId)) return null;

    if (
      state.files.some(
        (file) => file.documentId === state.currentFile.documentId,
      )
    ) {
      saveFlow();
    }
    const flowStore = useFlowStore.getState();
    const currentViewport = flowStore.viewport;
    const refreshed = get();
    const targetFile = refreshed.files.find((file) => file.documentId === documentId);
    if (!targetFile) return null;
    set({
      files: refreshed.files.map((file) =>
        file.documentId === refreshed.currentFile.documentId
          ? normalizeFileProjection({
              ...file,
              config: { ...file.config, savedViewport: { ...currentViewport } },
            })
          : file,
      ),
      currentFile: targetFile,
    });
    flowStore.replace(targetFile.nodes, targetFile.edges, {
      skipSave: true,
      isFitView: false,
    });
    flowStore.initHistory(targetFile.nodes, targetFile.edges);
    if (targetFile.config.savedViewport) {
      setTimeout(() => {
        flowStore.instance?.setViewport(targetFile.config.savedViewport!, {
          duration: 300,
        });
      }, 50);
    }
    return targetFile.documentId;
  },

  // 添加文件
  addFile(options) {
    const { isSwitch = true } = options ?? {};
    let activeKey = null;
    const newFile = createFile();
    useProjectSessionStore
      .getState()
      .registerDraft(newFile.fileName, "pipeline", newFile.documentId);
    set((state) => {
      const files = [...state.files];
      files.push(newFile);
      return { files };
    });
    if (isSwitch) {
      get().switchDocument(newFile.documentId);
      activeKey = newFile.fileName;
    }
    return activeKey;
  },

  // 删除文件
  removeFile(fileName) {
    const state = get();
    const target = state.files.find((file) => file.fileName === fileName);
    if (!target) return null;
    const nextId = get().removeDocument(target.documentId);
    return nextId
      ? get().files.find((file) => file.documentId === nextId)?.fileName ?? null
      : null;
  },

  removeDocument(documentId) {
    const state = get();
    const newFiles = state.files.filter((file) => file.documentId !== documentId);
    if (newFiles.length === state.files.length) return null;
    if (documentId !== state.currentFile.documentId) {
      set({ files: newFiles });
      return state.currentFile.documentId;
    }
    const nextFile = newFiles[0];
    const currentFile = nextFile ?? createFile();
    set({ files: newFiles, currentFile });
    const flowStore = useFlowStore.getState();
    flowStore.replace(currentFile.nodes, currentFile.edges, { skipSave: true });
    if (nextFile) flowStore.initHistory(nextFile.nodes, nextFile.edges);
    else flowStore.clearHistory();
    return nextFile?.documentId ?? null;
  },

  // 拖拽文件
  onDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      set((state) => {
        let files = state.files;
        const activeIndex = findFileIndex(active.id as string);
        const overIndex = findFileIndex(over?.id as string);
        files = arrayMove(files, activeIndex, overIndex);
        return { files };
      });
    }
  },

  // 替换
  replace(files) {
    try {
      if (!files) {
        restoreConfigCache();
        const ls = localStorage.getItem("_mpe_files");
        if (!ls) return Error.call("未找到本地files缓存");
        files = JSON.parse(ls) as FileType[];
      }
      const normalizedFiles = files.map(normalizeCachedFile);
      const currentFile = normalizedFiles[0] ?? createFile();
      set({ files: normalizedFiles, currentFile });
      useFlowStore.getState().replace(currentFile.nodes, currentFile.edges, {
        skipSave: true,
      });
      // 初始化历史记录
      useFlowStore.getState().initHistory(currentFile.nodes, currentFile.edges);
    } catch (err) {
      return err;
    }
    return null;
  },

  resetProjectSession() {
    const blankFile = createFile();
    set({ files: [], currentFile: blankFile });
    const flowStore = useFlowStore.getState();
    flowStore.replace([], [], { skipSave: true });
    flowStore.clearHistory();
  },

  clearProjectFiles() {
    const drafts = get().files.filter((file) =>
      file.documentId.startsWith("draft:"),
    );
    const currentFile =
      drafts.find((file) => file.documentId === get().currentFile.documentId) ??
      drafts[0] ??
      createFile();
    set({ files: drafts, currentFile });
    const flowStore = useFlowStore.getState();
    flowStore.replace(currentFile.nodes, currentFile.edges, { skipSave: true });
    if (drafts.length) flowStore.initHistory(currentFile.nodes, currentFile.edges);
    else flowStore.clearHistory();
  },

  // 从本地打开文件
  async openFileFromLocal(
    filePath: string,
    content: any,
    mpeConfig?: any,
    configPath?: string,
    documentId?: DocumentId,
  ): Promise<boolean> {
    try {
      const contentString =
        typeof content === "string" ? content : JSON.stringify(content);

      // 从文件路径提取真实文件名（不含扩展名）
      const realFileName = (filePath.split(/[/\\]/).pop() || "").replace(
        /\.(json|jsonc)$/i,
        "",
      );

      // 构建配置更新
      const configUpdates: Partial<FileConfigType> = {
        lastSyncTime: Date.now(),
      };
      if (configPath) {
        configUpdates.separatedConfigPath = configPath;
      }

      // 查找是否已有相同路径的文件打开
      const existingFile = useFileStore
        .getState()
        .files.find((file) =>
          documentId
            ? file.documentId === documentId
            : file.config.filePath === filePath,
        );

      if (existingFile) {
        // 切换到已有文件并更新内容
        useFileStore.getState().switchDocument(existingFile.documentId);
        if (!(await pipelineToFlow({ pString: contentString, mpeConfig }))) {
          return false;
        }
        syncFlowStoreToFileStore(configUpdates);
        return true;
      }

      // 直接导入
      const currentFile = useFileStore.getState().currentFile;
      if (
        useFileStore.getState().files.some(
          (file) => file.fileName === currentFile.fileName,
        ) &&
        currentFile.nodes.length === 0 &&
        currentFile.edges.length === 0 &&
        !currentFile.config.filePath
      ) {
        const savedViewport = currentFile.config.savedViewport;
        if (!(await pipelineToFlow({ pString: contentString, mpeConfig }))) {
          return false;
        }
        syncFlowStoreToFileStore({ ...configUpdates, filePath });
        if (documentId) replaceCurrentDocumentId(documentId);
        // 设置文件名
        useFileStore.getState().setFileName(realFileName);
        // 恢复视口
        if (savedViewport) {
          setTimeout(() => {
            const instance = useFlowStore.getState().instance;
            if (instance) {
              instance.setViewport(savedViewport, { duration: 300 });
            }
          }, 50);
        }
        return true;
      }

      // 新建文件
      useFileStore.getState().addFile({ isSwitch: true });
      if (documentId) replaceCurrentDocumentId(documentId);
      if (!(await pipelineToFlow({ pString: contentString, mpeConfig }))) {
        return false;
      }
      syncFlowStoreToFileStore({ ...configUpdates, filePath });
      // 设置文件名
      useFileStore.getState().setFileName(realFileName);
      return true;
    } catch (error) {
      console.error("[fileStore] Failed to open file from local:", error);
      return false;
    }
  },

  // 根据路径查找文件
  findFileByPath(filePath: string): FileType | undefined {
    return useFileStore
      .getState()
      .files.find((file) => file.config.filePath === filePath);
  },

  findFileByDocumentId(documentId: DocumentId): FileType | undefined {
    return useFileStore
      .getState()
      .files.find((file) => file.documentId === documentId);
  },

  applyDocumentIdMappings(mappings) {
    const ids = new Map(
      mappings.map((mapping) => [
        mapping.oldDocumentId,
        asDocumentId(mapping.newDocumentId),
      ]),
    );
    set((state) => {
      const update = (file: FileType): FileType => ({
        ...file,
        documentId: ids.get(file.documentId) ?? file.documentId,
      });
      return {
        files: state.files.map(update),
        currentFile: update(state.currentFile),
      };
    });
  },

  renamePath(oldPath, newPath, isDirectory) {
    set((state) => {
      const update = (file: FileType) => {
        const filePath = file.config.filePath
          ? remapProjectPath(file.config.filePath, oldPath, newPath, isDirectory)
          : undefined;
        const separatedConfigPath = remapSeparatedConfigPath(
          file.config.separatedConfigPath,
          file.config.filePath,
          oldPath,
          newPath,
          isDirectory,
        );
        if (
          filePath === file.config.filePath &&
          separatedConfigPath === file.config.separatedConfigPath
        ) {
          return file;
        }
        const exactRename =
          file.config.filePath?.replaceAll("\\", "/") ===
          oldPath.replaceAll("\\", "/");
        return {
          ...file,
          fileName: exactRename
            ? (newPath.split(/[\\/]/).pop() ?? file.fileName).replace(
                /\.(json|jsonc)$/i,
                "",
              )
            : file.fileName,
          config: { ...file.config, filePath, separatedConfigPath },
        };
      };
      return { files: state.files.map(update), currentFile: update(state.currentFile) };
    });
  },
}));

function replaceCurrentDocumentId(documentId: DocumentId): void {
  useFileStore.setState((state) => {
    const currentDocumentId = state.currentFile.documentId;
    return {
      files: state.files.map((file) =>
        file.documentId === currentDocumentId ? { ...file, documentId } : file,
      ),
      currentFile: { ...state.currentFile, documentId },
    };
  });
}

function remapSeparatedConfigPath(
  separatedConfigPath: string | undefined,
  pipelinePath: string | undefined,
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
): string | undefined {
  if (!separatedConfigPath) return undefined;
  const directlyRemapped = remapProjectPath(
    separatedConfigPath,
    oldPath,
    newPath,
    isDirectory,
  );
  if (directlyRemapped !== normalizeProjectPath(separatedConfigPath)) {
    return directlyRemapped;
  }
  if (
    isDirectory ||
    !pipelinePath ||
    normalizeProjectPath(pipelinePath) !== normalizeProjectPath(oldPath)
  ) {
    return directlyRemapped;
  }
  const oldBase = projectPathName(oldPath).replace(/\.(json|jsonc)$/i, "");
  const sidecarName = projectPathName(separatedConfigPath);
  const sidecarMatch = sidecarName.match(/^\.(.+)\.mpe\.(jsonc?)$/i);
  if (!sidecarMatch || sidecarMatch[1] !== oldBase) return directlyRemapped;
  const newBase = projectPathName(newPath).replace(/\.(json|jsonc)$/i, "");
  const normalizedNew = normalizeProjectPath(newPath);
  const lastSeparator = normalizedNew.lastIndexOf("/");
  const directory =
    lastSeparator >= 0 ? normalizedNew.slice(0, lastSeparator + 1) : "";
  return `${directory}.${newBase}.mpe.${sidecarMatch[2]}`;
}
