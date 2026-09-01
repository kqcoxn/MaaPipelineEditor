import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { notification } from "antd";
import { visit } from "jsonc-parser";

import { useFlowStore, type NodeType, type EdgeType } from "@/stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import {
  pipelineToFlow,
  flowToPipelineString,
  flowToSeparatedStrings,
  getConfigFileName,
  mergePipelineAndConfig,
} from "@/core/parser";
import { localServer } from "@/services/server";
import { FileProtocol } from "@/services/protocols/FileProtocol";
import { findErrorsByType, ErrorTypeEnum } from "@/stores/app/errorStore";
import type { CoordinateMode } from "@/stores/flow/utils/coordinateUtils";
import {
  areFilePathsEqual,
  isFilePathWithinRoot,
} from "./filePathUtils";

export type FileConfigType = {
  prefix: string;
  coordinateMode?: CoordinateMode;
  filePath?: string;
  relativePath?: string;
  separatedConfigPath?: string;
  isDeleted?: boolean;
  isModifiedExternally?: boolean;
  lastSyncTime?: number;
  savedViewport?: { x: number; y: number; zoom: number };
  // 节点顺序管理
  nodeOrderMap?: Record<string, number>;
  nextOrderNumber?: number;
};
export type FileType = {
  fileName: string;
  nodes: NodeType[];
  edges: EdgeType[];
  config: FileConfigType;
};

export interface FileCacheRepairResult {
  staleFileNames: string[];
}

/**
 * 根据 LocalBridge 当前根目录修复旧版本留下的文件缓存。
 *
 * 缓存内容不会被删除；根目录外的非当前文件只标记为不可保存/不可参与
 * 调试，待用户重新打开文件后由 openFileFromLocal 清除该标记。
 */
export function repairFileCacheForRoot(rootPath: string): FileCacheRepairResult {
  const staleFileNames: string[] = [];
  const state = useFileStore.getState();
  const currentFileName = state.currentFile.fileName;

  if (!rootPath) return { staleFileNames };

  useFileStore.setState((nextState) => {
    nextState.files = nextState.files.map((file) => {
      const filePath = file.config.filePath;
      if (
        !filePath ||
        file.fileName === currentFileName ||
        file.config.isDeleted ||
        isFilePathWithinRoot(filePath, rootPath)
      ) {
        return file;
      }

      staleFileNames.push(file.fileName);
      return {
        ...file,
        config: {
          ...file.config,
          isDeleted: true,
        },
      };
    });
    return {};
  });

  return { staleFileNames };
}

/**辅助函数 */
// 查找文件
function findFile(fileName: string): FileType | undefined {
  return useFileStore
    .getState()
    .files.find((file) => file.fileName === fileName);
}
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
function createFile(options?: { fileName?: string; config?: any }): FileType {
  const { fileName: initialFileName = "新建Pipeline" + fileIdCounter++, config } =
    options || {};
  let fileName = initialFileName;
  while (isFileNameRepate(fileName, false)) {
    fileName = "新建Pipeline" + fileIdCounter++;
  }
  return {
    fileName,
    nodes: [],
    edges: [],
    config: { prefix: "", ...config },
  };
}
const defaltFile = createFile();
let lastSyncedGraphRevision = -1;
let lastSyncedFileName = "";

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
    const currentFile: FileType = {
      ...state.currentFile,
      nodes,
      edges,
      config: additionalConfig
        ? { ...state.currentFile.config, ...additionalConfig }
        : state.currentFile.config,
    };

    // 同步更新 files 数组中对应的文件
    const currentFileName = currentFile.fileName;
    const fileIndex = state.files.findIndex(
      (f) => f.fileName === currentFileName,
    );
    const files =
      fileIndex >= 0
        ? state.files.map((file, index) =>
            index === fileIndex ? currentFile : file,
          )
        : state.files;
    return { currentFile, files };
  });
  lastSyncedGraphRevision = flowStore.graphRevision;
  lastSyncedFileName = useFileStore.getState().currentFile.fileName;
}

/** 从 JSONC 内容中提取顶层键顺序 */
function extractKeyOrder(contentString: string): string[] {
  const keyOrder: string[] = [];
  let currentDepth = 0;
  try {
    visit(
      contentString,
      {
        onObjectBegin: () => {
          currentDepth++;
        },
        onObjectEnd: () => {
          currentDepth--;
        },
        onObjectProperty: (property) => {
          if (currentDepth === 1) {
            keyOrder.push(property);
          }
        },
      },
      { allowTrailingComma: true },
    );
  } catch (e) {
    console.warn("[fileStore] Failed to extract key order:", e);
  }
  return keyOrder;
}

/** 保存后更新文件配置 */
function updateFileConfigAfterSave(
  fileName: string,
  updates: Partial<FileConfigType>,
): void {
  useFileStore.setState((state) => {
    const fileIndex = state.files.findIndex((f) => f.fileName === fileName);
    if (fileIndex >= 0) {
      state.files[fileIndex] = {
        ...state.files[fileIndex],
        config: {
          ...state.files[fileIndex].config,
          ...updates,
        },
      };
    }
    if (state.currentFile.fileName === fileName) {
      state.currentFile = {
        ...state.currentFile,
        config: {
          ...state.currentFile.config,
          ...updates,
        },
      };
    }
    return {};
  });
}

// 保存Flow
export function saveFlow(): FileType | null {
  try {
    const flowState = useFlowStore.getState();
    const fileState = useFileStore.getState();
    const currentFileName = fileState.currentFile.fileName;
    if (
      lastSyncedGraphRevision === flowState.graphRevision &&
      lastSyncedFileName === currentFileName
    ) {
      return fileState.currentFile;
    }
    const fileIndex = fileState.files.findIndex(
      (f) => f.fileName === currentFileName,
    );

    if (fileIndex < 0) {
      console.error("[fileStore] saveFlow: 当前文件不在 files 数组中");
      return null;
    }

    // 清除选中状态并更新数据
    const updatedNodes = flowState.nodes.map((node: NodeType) => ({
      ...node,
      selected: undefined,
    }));
    const updatedEdges = flowState.edges.map((edge: EdgeType) => ({
      ...edge,
      selected: undefined,
    }));

    // 更新状态
    useFileStore.setState((state) => {
      const currentFile = {
        ...state.currentFile,
        nodes: updatedNodes,
        edges: updatedEdges,
      };
      const files = state.files.map((file, index) =>
        index === fileIndex ? currentFile : file,
      );
      return { currentFile, files };
    });

    lastSyncedGraphRevision = flowState.graphRevision;
    lastSyncedFileName = currentFileName;

    return useFileStore.getState().currentFile;
  } catch (err) {
    console.error("[fileStore] saveFlow 失败:", err);
    return null;
  }
}
export interface SaveOpenedLocalFilesResult {
  savedCount: number;
  failedFiles: string[];
}

export async function saveOpenedLocalFilesForDebug(): Promise<SaveOpenedLocalFilesResult> {
  saveFlow();

  const filesToSave = useFileStore
    .getState()
    .files.filter(
      (file) => file.config.filePath && !file.config.isDeleted,
    );
  const failedFiles: string[] = [];
  let savedCount = 0;

  for (const file of filesToSave) {
    const targetPath = file.config.filePath;
    if (!targetPath) continue;

    try {
      const success = await useFileStore
        .getState()
        .saveFileToLocal(targetPath, file);
      if (success) {
        savedCount += 1;
      } else {
        failedFiles.push(file.fileName);
      }
    } catch (error) {
      console.error(
        `[fileStore] Failed to save file before debug: ${file.fileName}`,
        error,
      );
      failedFiles.push(file.fileName);
    }
  }

  return {
    savedCount,
    failedFiles,
  };
}

// 批量分配新的顺序号，避免大批量操作逐节点触发文件配置订阅。
export function assignNodeOrders(nodeIds: string[]): number[] {
  if (nodeIds.length === 0) return [];

  const state = useFileStore.getState();
  const config = state.currentFile.config;
  const orderMap = { ...(config.nodeOrderMap ?? {}) };
  const nextOrder = config.nextOrderNumber ?? 0;
  const orders = nodeIds.map((nodeId, index) => {
    const order = nextOrder + index;
    orderMap[nodeId] = order;
    return order;
  });

  state.setFileConfigs({
    nodeOrderMap: orderMap,
    nextOrderNumber: nextOrder + nodeIds.length,
  });

  return orders;
}

// 分配新的顺序号
export function assignNodeOrder(nodeId: string): number {
  return assignNodeOrders([nodeId])[0];
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
  setFileConfigs: (values: Partial<FileConfigType>) => void;
  switchFile: (fileName: string) => string | null;
  addFile: (options?: { isSwitch: boolean }) => string | null;
  removeFile: (fileName: string) => string | null;
  onDragEnd: (result: DragEndEvent) => void;
  replace: (files: FileType[], currentFileName?: string) => unknown;
  // 本地文件操作方法
  openFileFromLocal: (
    filePath: string,
    content: any,
    mpeConfig?: any,
    configPath?: string,
  ) => Promise<boolean>;
  saveFileToLocal: (
    filePath?: string,
    fileToSave?: FileType,
    saveMode?: "all" | "pipeline" | "config",
  ) => Promise<boolean>;
  markFileDeleted: (filePath: string) => void;
  markFileModified: (filePath: string) => void;
  reloadFileFromLocal: (filePath: string, content: any) => Promise<boolean>;
  findFileByPath: (filePath: string) => FileType | undefined;
};

function updateFileConfigState(
  state: FileState,
  values: Partial<FileConfigType>,
): Pick<FileState, "currentFile" | "files"> {
  const config = { ...state.currentFile.config, ...values };
  const currentFile = { ...state.currentFile, config };
  const currentFileIndex = state.files.findIndex(
    (file) => file.fileName === currentFile.fileName,
  );
  const files =
    currentFileIndex >= 0
      ? state.files.map((file, index) =>
          index === currentFileIndex ? currentFile : file,
        )
      : state.files;
  return { currentFile, files };
}

export const useFileStore = create<FileState>()(subscribeWithSelector((set) => ({
  files: [defaltFile],
  currentFile: defaltFile,

  // 修改文件名
  setFileName(fileName) {
    // 空文件名
    if (!fileName) return false;
    // 修改名
    let isValid = true;
    set((state) => {
      // 文件名重复
      isValid = !isFileNameRepate(fileName);
      if (!isValid) return {};
      // 修改
      let files = state.files;
      let currentFile = state.currentFile;
      const index = findFileIndex(currentFile.fileName);
      currentFile = { ...state.currentFile, fileName };
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
    set((state) => updateFileConfigState(state, { [key]: value }));
  },

  // 批量设置文件配置
  setFileConfigs(values) {
    set((state) => updateFileConfigState(state, values));
  },

  // 切换文件
  switchFile: (fileName: string) => {
    let activeKey = null;
    let needReload = false;
    let reloadFilePath: string | undefined;
    set((state) => {
      // 查找文件
      const currentFile = state.currentFile;
      if (currentFile.fileName === fileName) return {};
      const targetFile = findFile(fileName);
      if (!targetFile) return {};
      activeKey = targetFile.fileName;

      // 检测目标文件是否被外部修改
      if (
        targetFile.config.isModifiedExternally &&
        targetFile.config.filePath
      ) {
        needReload = true;
        reloadFilePath = targetFile.config.filePath;
      }

      // 保存当前flow和视口位置
      saveFlow();
      const flowStore = useFlowStore.getState();
      // 保存当前文件的视口位置到files数组中
      const currentViewport = flowStore.viewport;
      const currentFileIndex = findFileIndex(currentFile.fileName);
      if (currentFileIndex >= 0) {
        state.files[currentFileIndex].config.savedViewport = {
          ...currentViewport,
        };
      }
      // 更新flow
      flowStore.replace(targetFile.nodes, targetFile.edges, {
        skipSave: true,
        isFitView: false,
      });
      // 初始化历史记录
      flowStore.initHistory(targetFile.nodes, targetFile.edges);
      // 恢复目标文件的视口位置
      if (targetFile.config.savedViewport) {
        setTimeout(() => {
          const instance = flowStore.instance;
          if (instance) {
            instance.setViewport(targetFile.config.savedViewport!, {
              duration: 300,
            });
          }
        }, 50);
      }
      return { currentFile: targetFile };
    });

    // 如果目标文件被外部修改，触发重载
    if (needReload && reloadFilePath) {
      setTimeout(() => {
        import("@/services/server").then(({ localServer }) => {
          if (localServer.isConnected()) {
            localServer.send("/etl/open_file", { file_path: reloadFilePath });
          }
        });
      }, 0);
    }

    return activeKey;
  },

  // 添加文件
  addFile(options) {
    const { isSwitch = true } = options ?? {};
    let activeKey = null;
    const newFile = createFile();
    set((state) => {
      const files = [...state.files];
      files.push(newFile);
      return { files };
    });
    if (isSwitch) {
      set((state) => {
        const newFileName = newFile.fileName;
        state.switchFile(newFileName);
        activeKey = newFileName;
        return {};
      });
    }
    return activeKey;
  },

  // 删除文件
  removeFile(fileName) {
    let activeKey = null;
    set((state) => {
      const files = state.files;
      const newFiles = files.filter((file) => file.fileName !== fileName);
      if (newFiles.length === 0 || files.length - newFiles.length !== 1) {
        return {};
      }
      if (fileName === state.currentFile.fileName) {
        const newFileName = newFiles[0].fileName;
        state.switchFile(newFileName);
        activeKey = newFileName;
      }
      return { files: newFiles };
    });
    return activeKey;
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
  replace(files, currentFileName) {
    try {
      if (files.length === 0) return Error.call("文件缓存为空");
      const currentFile =
        files.find((file) => file.fileName === currentFileName) ?? files[0];
      set({ files, currentFile });
      useFlowStore
        .getState()
        .replace(currentFile.nodes, currentFile.edges, { skipSave: true });
      // 初始化历史记录
      useFlowStore.getState().initHistory(currentFile.nodes, currentFile.edges);
      lastSyncedGraphRevision = useFlowStore.getState().graphRevision;
      lastSyncedFileName = currentFile.fileName;
    } catch (err) {
      return err;
    }
    return null;
  },

  // 从本地打开文件
  async openFileFromLocal(
    filePath: string,
    content: any,
    mpeConfig?: any,
    configPath?: string,
  ): Promise<boolean> {
    try {
      const contentString =
        typeof content === "string" ? content : JSON.stringify(content);

      // 获取原始键顺序
      const keyOrder = extractKeyOrder(contentString);

      // 从文件路径提取真实文件名（不含扩展名）
      const realFileName = (filePath.split(/[/\\]/).pop() || "").replace(
        /\.(json|jsonc)$/i,
        "",
      );

      // 合并配置文件
      let finalContentString = contentString;
      if (mpeConfig) {
        try {
          const pipelineObj = JSON.parse(contentString);
          const mergedPipeline = mergePipelineAndConfig(
            pipelineObj,
            mpeConfig,
            realFileName,
            keyOrder,
          );
          finalContentString = JSON.stringify(mergedPipeline);
        } catch (error) {
          console.error(
            "[fileStore] Failed to merge config, using pipeline only:",
            error,
          );
        }
      }

      // 构建配置更新
      const configUpdates: Partial<FileConfigType> = {
        lastSyncTime: Date.now(),
        isModifiedExternally: false,
        isDeleted: false,
      };
      if (configPath) {
        configUpdates.separatedConfigPath = configPath;
      }

      // 查找是否已有相同路径的文件打开
      const existingFile = useFileStore
        .getState()
        .files.find((file) =>
          areFilePathsEqual(file.config.filePath, filePath),
        );

      if (existingFile) {
        // 切换到已有文件并更新内容
        useFileStore.getState().switchFile(existingFile.fileName);
        await pipelineToFlow({ pString: finalContentString });
        syncFlowStoreToFileStore(configUpdates);
        return true;
      }

      // 直接导入
      const currentFile = useFileStore.getState().currentFile;
      if (
        currentFile.nodes.length === 0 &&
        currentFile.edges.length === 0 &&
        !currentFile.config.filePath
      ) {
        const savedViewport = currentFile.config.savedViewport;
        await pipelineToFlow({ pString: finalContentString });
        syncFlowStoreToFileStore({ ...configUpdates, filePath });
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
      await pipelineToFlow({ pString: finalContentString });
      syncFlowStoreToFileStore({ ...configUpdates, filePath });
      // 设置文件名
      useFileStore.getState().setFileName(realFileName);
      return true;
    } catch (error) {
      console.error("[fileStore] Failed to open file from local:", error);
      return false;
    }
  },

  // 保存文件到本地
  async saveFileToLocal(
    filePath?: string,
    fileToSave?: FileType,
    saveMode?: "all" | "pipeline" | "config",
  ): Promise<boolean> {
    try {
      const state = useFileStore.getState();

      // 优先使用传入的文件，否则使用当前文件
      const targetFile = fileToSave || state.currentFile;
      const configHandlingMode =
        useConfigStore.getState().configs.configHandlingMode;
      const targetFilePath = filePath || targetFile.config.filePath;

      if (!targetFilePath) {
        console.error("[fileStore] No file path specified");
        return false;
      }

      if (!localServer.isConnected()) {
        console.error("[fileStore] WebSocket not connected");
        return false;
      }

      // 检查是否有节点名重复错误
      const repeatErrors = findErrorsByType(ErrorTypeEnum.NodeNameRepeat);
      if (repeatErrors.length > 0) {
        notification.error({
          title: "保存失败！",
          description: `存在重复的节点名: ${repeatErrors
            .map((e) => e.msg)
            .join(", ")}，请修改后再试。`,
          placement: "top",
        });
        return false;
      }

      // 同步当前 flowStore 数据到 fileStore
      let nodesToSave = targetFile.nodes;
      let edgesToSave = targetFile.edges;

      if (!fileToSave || fileToSave === state.currentFile) {
        const flowState = useFlowStore.getState();
        nodesToSave = flowState.nodes.map((node: NodeType) => ({
          ...node,
          selected: undefined,
        }));
        edgesToSave = flowState.edges.map((edge: EdgeType) => ({
          ...edge,
          selected: undefined,
        }));

        // 更新 fileStore 中的数据
        useFileStore.setState((s) => {
          const fileIndex = s.files.findIndex(
            (f) => f.fileName === targetFile.fileName,
          );
          if (fileIndex >= 0) {
            s.files[fileIndex] = {
              ...s.files[fileIndex],
              nodes: nodesToSave,
              edges: edgesToSave,
            };
          }
          s.currentFile.nodes = nodesToSave;
          s.currentFile.edges = edgesToSave;
          return {};
        });
      }

      // 构建导出选项
      const exportOptions = {
        nodes: nodesToSave,
        edges: edgesToSave,
        fileName: targetFile.fileName,
        config: targetFile.config,
      };

      let sendSuccess = false;
      const configUpdates: Partial<FileConfigType> = {
        filePath: targetFilePath,
      };

      // 生成配置文件路径
      const generateConfigPath = (pipelinePath: string): string => {
        const lastSlashIndex = Math.max(
          pipelinePath.lastIndexOf("/"),
          pipelinePath.lastIndexOf("\\"),
        );
        const directory = pipelinePath.substring(0, lastSlashIndex + 1);
        const fileName = pipelinePath.substring(lastSlashIndex + 1);

        // 只有带前缀点号的文件才是分离配置文件。
        // 例如 search.mpe.json 仍可能是合法的 Pipeline 文件名，不能与配置文件混用。
        if (
          fileName.startsWith(".") &&
          (fileName.endsWith(".mpe.json") || fileName.endsWith(".mpe.jsonc"))
        ) {
          return pipelinePath;
        }

        return `${directory}${getConfigFileName(fileName)}`;
      };

      // 根据保存模式确定要等待 ACK 的文件路径
      let ackFilePath = targetFilePath;

      // 获取 JSON 缩进配置
      const jsonIndent = useConfigStore.getState().configs.jsonIndent;

      if (configHandlingMode === "separated") {
        // 分离模式保存
        const { pipelineString, configString } =
          flowToSeparatedStrings(exportOptions);
        const configPath = generateConfigPath(targetFilePath);

        // 根据保存模式决定保存哪些内容
        const effectiveMode = saveMode || "all";

        if (effectiveMode === "all") {
          // 全部保存
          ackFilePath = targetFilePath;
          sendSuccess = localServer.send("/etl/save_separated", {
            pipeline_path: targetFilePath,
            config_path: configPath,
            pipeline: pipelineString,
            config: configString,
            indent: jsonIndent,
          });
          if (sendSuccess) {
            configUpdates.separatedConfigPath = configPath;
          }
        } else if (effectiveMode === "pipeline") {
          // 等待 pipeline 路径的 ack
          ackFilePath = targetFilePath;
          sendSuccess = localServer.send("/etl/save_file", {
            file_path: targetFilePath,
            content: pipelineString,
            indent: jsonIndent,
          });
        } else if (effectiveMode === "config") {
          // 等待 config 路径的 ack
          ackFilePath = configPath;
          sendSuccess = localServer.send("/etl/save_file", {
            file_path: configPath,
            content: configString,
            indent: jsonIndent,
          });
          if (sendSuccess) {
            configUpdates.separatedConfigPath = configPath;
          }
        }
      } else {
        // 集成模式或不导出模式
        const pipelineString = flowToPipelineString(exportOptions);

        sendSuccess = localServer.send("/etl/save_file", {
          file_path: targetFilePath,
          content: pipelineString,
          indent: jsonIndent,
        });
      }

      if (!sendSuccess) {
        console.error("[fileStore] Failed to send save request");
        return false;
      }

      // 等待确认回调
      const ackPromise = FileProtocol.waitForSaveAck(ackFilePath);

      // 等待后端确认
      const ackSuccess = await ackPromise;

      if (ackSuccess) {
        configUpdates.lastSyncTime = Date.now();
        updateFileConfigAfterSave(targetFile.fileName, configUpdates);
        return true;
      } else {
        console.error("[fileStore] Save ack not received or failed");
        return false;
      }
    } catch (error) {
      console.error("[fileStore] Failed to save file to local:", error);
      return false;
    }
  },

  // 标记文件为已删除
  markFileDeleted(filePath: string): void {
    set((state) => {
      const currentFilePath = state.currentFile.config.filePath;
      state.files = state.files.map((file) => {
        if (areFilePathsEqual(file.config.filePath, filePath)) {
          const updated = {
            ...file,
            config: { ...file.config, isDeleted: true },
          };
          // 如果是当前文件，同步更新 currentFile
          if (areFilePathsEqual(filePath, currentFilePath)) {
            state.currentFile = updated;
          }
          return updated;
        }
        return file;
      });
      return {};
    });
  },

  // 标记文件被外部修改
  markFileModified(filePath: string): void {
    set((state) => {
      const currentFilePath = state.currentFile.config.filePath;
      state.files = state.files.map((file) => {
        if (areFilePathsEqual(file.config.filePath, filePath)) {
          const updated = {
            ...file,
            config: { ...file.config, isModifiedExternally: true },
          };
          // 如果是当前文件，同步更新 currentFile
          if (areFilePathsEqual(filePath, currentFilePath)) {
            state.currentFile = updated;
          }
          return updated;
        }
        return file;
      });
      return {};
    });
  },

  // 重新加载文件
  async reloadFileFromLocal(filePath: string, content: any): Promise<boolean> {
    try {
      const contentString =
        typeof content === "string" ? content : JSON.stringify(content);

      // 查找文件
      const targetFile = useFileStore
        .getState()
        .files.find((file) =>
          areFilePathsEqual(file.config.filePath, filePath),
        );

      if (!targetFile) {
        console.error("[fileStore] File not found:", filePath);
        return false;
      }

      // 切换到该文件并重新加载
      useFileStore.getState().switchFile(targetFile.fileName);
      await pipelineToFlow({ pString: contentString });

      // 同步 FlowStore 数据到 FileStore，清除修改标记
      syncFlowStoreToFileStore({
        isModifiedExternally: false,
        isDeleted: false,
        lastSyncTime: Date.now(),
      });

      return true;
    } catch (error) {
      console.error("[fileStore] Failed to reload file from local:", error);
      return false;
    }
  },

  // 根据路径查找文件
  findFileByPath(filePath: string): FileType | undefined {
    return useFileStore
      .getState()
      .files.find((file) =>
        areFilePathsEqual(file.config.filePath, filePath),
      );
  },
})));
