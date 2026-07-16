/**
 * 跨文件工具服务
 * 提供跨文件节点搜索、跳转、自动完成等功能
 */

import { useWSStore } from "../stores/wsStore";
import { useLocalFileStore } from "../stores/localFileStore";
import { useFileStore } from "../stores/fileStore";
import { useConfigStore } from "../stores/configStore";
import {
  useFlowStore,
  getNodeAbsolutePosition,
  type NodeType,
} from "../stores/flow";
import { localServer } from "./server";
import { NodeTypeEnum } from "../components/flow/nodes/constants";
import { getFullNodeName } from "../utils/node/nodeNameHelper";
import {
  filterLocalFilesByFolderFilter,
  matchesFolderFilter,
} from "../utils/file/folderFilter";

/**
 * 跨文件节点信息
 */
export interface CrossFileNodeInfo {
  /** 节点标签（不含前缀） */
  label: string;
  /** 完整节点名（含前缀） */
  fullName: string;
  /** 节点类型 */
  nodeType: NodeTypeEnum;
  /** 文件路径（本地文件）或文件名（前端tab） */
  filePath: string;
  /** 相对路径（用于显示） */
  relativePath: string;
  /** 是否是当前文件 */
  isCurrentFile: boolean;
  /** 是否已加载到前端 */
  isLoaded: boolean;
  /** 文件前缀 */
  prefix: string;
}

/**
 * 跨文件服务类
 */
class CrossFileService {
  /**
   * 检查是否已连接 LocalBridge
   */
  isConnected(): boolean {
    return useWSStore.getState().connected && localServer.isConnected();
  }

  /**
   * 获取所有可用的节点列表
   * - 连接 localbridge 时：localbridge 加载的所有文件 + 前端 tab 里非本地文件
   * - 未连接时：前端 tab 里的所有文件
   */
  getAllNodes(): CrossFileNodeInfo[] {
    const isConnected = this.isConnected();
    const currentFile = useFileStore.getState().currentFile;
    const result: CrossFileNodeInfo[] = [];

    if (isConnected) {
      // 连接 localbridge 时
      // 从 localFileStore 获取所有本地文件的节点
      const allLocalFiles = useLocalFileStore.getState().files;
      const folderFilter =
        useConfigStore.getState().configs.crossFileSearchFolderFilter;
      const localFiles = filterLocalFilesByFolderFilter(
        allLocalFiles,
        folderFilter,
      );
      const loadedFiles = useFileStore.getState().files;
      const processedFilePaths = new Set<string>(); // 记录已处理的文件路径
      const localFilePaths = new Set(
        allLocalFiles.map((file) => file.file_path),
      );

      // 处理本地文件
      for (const localFile of localFiles) {
        processedFilePaths.add(localFile.file_path);

        const loadedFile = loadedFiles.find(
          (f) => f.config.filePath === localFile.file_path,
        );

        if (loadedFile) {
          // 已加载的本地文件，从 loadedFile 获取节点
          const isCurrentFile = loadedFile.fileName === currentFile.fileName;
          const prefix = loadedFile.config.prefix || "";

          for (const node of loadedFile.nodes) {
            result.push({
              label: node.data.label,
              fullName: getFullNodeName(node.data.label, prefix),
              nodeType: node.type as NodeTypeEnum,
              filePath: localFile.file_path,
              relativePath: localFile.relative_path,
              isCurrentFile,
              isLoaded: true,
              prefix,
            });
          }
        } else {
          // 未加载的本地文件，从 localFile.nodes 获取节点列表
          // 注意：LocalBridge 返回的 label 是 JSON 键名（带前缀）
          // 需要去除前缀以保持与已加载文件一致
          const filePrefix = localFile.prefix || "";

          for (const nodeInfo of localFile.nodes || []) {
            // 从 JSON 键名中去除前缀，得到真正的 label
            // 优先使用节点自带的 prefix 字段（如果没有则使用文件级 prefix）
            let prefix = nodeInfo.prefix || filePrefix;
            let label = nodeInfo.label;

            // 如果 prefix 为空，尝试从 label 中推断
            // 假设格式为 "prefix_actualLabel"，找到最后一个下划线
            if (!prefix && label.includes("_")) {
              const lastUnderscoreIndex = label.lastIndexOf("_");
              const possiblePrefix = label.substring(0, lastUnderscoreIndex);
              const possibleLabel = label.substring(lastUnderscoreIndex + 1);

              // 只有当推断的 label 部分不为空时才使用
              if (possibleLabel) {
                prefix = possiblePrefix;
                label = possibleLabel;
              }
            } else if (prefix && label.startsWith(prefix + "_")) {
              // 如果有 prefix，直接去除
              label = label.slice(prefix.length + 1);
            }

            result.push({
              label,
              fullName: nodeInfo.label, // JSON 键名就是完整名
              nodeType: NodeTypeEnum.Pipeline, // 未加载文件默认为 Pipeline 节点
              filePath: localFile.file_path,
              relativePath: localFile.relative_path,
              isCurrentFile: false,
              isLoaded: false,
              prefix,
            });
          }
        }
      }

      // 处理前端 tab 中所有已加载的文件（包括不在 LocalBridge 扫描列表中的）
      for (const file of loadedFiles) {
        // 跳过已处理的文件
        if (
          file.config.filePath &&
          (processedFilePaths.has(file.config.filePath) ||
            (localFilePaths.has(file.config.filePath) &&
              file.fileName !== currentFile.fileName &&
              !matchesFolderFilter(
                file.config.relativePath || file.fileName,
                folderFilter,
              )))
        ) {
          continue;
        }

        const isCurrentFile = file.fileName === currentFile.fileName;
        const prefix = file.config.prefix || "";

        for (const node of file.nodes) {
          result.push({
            label: node.data.label,
            fullName: getFullNodeName(node.data.label, prefix),
            nodeType: node.type as NodeTypeEnum,
            filePath: file.config.filePath || file.fileName,
            relativePath: file.config.relativePath || file.fileName,
            isCurrentFile,
            isLoaded: true,
            prefix,
          });
        }
      }
    } else {
      // 未连接 localbridge 时：前端 tab 里的所有文件
      const loadedFiles = useFileStore.getState().files;

      for (const file of loadedFiles) {
        const isCurrentFile = file.fileName === currentFile.fileName;
        const prefix = file.config.prefix || "";

        for (const node of file.nodes) {
          result.push({
            label: node.data.label,
            fullName: getFullNodeName(node.data.label, prefix),
            nodeType: node.type as NodeTypeEnum,
            filePath: file.config.filePath || file.fileName,
            relativePath: file.config.relativePath || file.fileName,
            isCurrentFile,
            isLoaded: true,
            prefix,
          });
        }
      }
    }

    return result;
  }

  /**
   * 搜索节点（支持模糊匹配）
   * @param keyword 搜索关键词
   * @param options 选项
   * @returns 匹配的节点列表，当前文件优先
   */
  searchNodes(
    keyword: string,
    options?: {
      /** 是否启用跨文件搜索 */
      crossFile?: boolean;
      /** 最大返回数量 */
      limit?: number;
      /** 排除的节点类型 */
      excludeTypes?: NodeTypeEnum[];
    },
  ): CrossFileNodeInfo[] {
    const { crossFile = true, limit = 10, excludeTypes = [] } = options || {};

    let allNodes = this.getAllNodes();

    // 类型过滤
    if (excludeTypes.length > 0) {
      allNodes = allNodes.filter((n) => !excludeTypes.includes(n.nodeType));
    }

    // 不启用跨文件时，只搜索当前文件
    if (!crossFile) {
      allNodes = allNodes.filter((n) => n.isCurrentFile);
    }

    // 空关键词返回空
    if (!keyword.trim()) {
      return [];
    }

    const lowerKeyword = keyword.toLowerCase();

    // 模糊匹配
    const matched = allNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(lowerKeyword) ||
        n.fullName.toLowerCase().includes(lowerKeyword),
    );

    // 排序：当前文件优先，然后按匹配度
    matched.sort((a, b) => {
      // 当前文件优先
      if (a.isCurrentFile && !b.isCurrentFile) return -1;
      if (!a.isCurrentFile && b.isCurrentFile) return 1;

      // 完全匹配优先
      const aExact = a.label.toLowerCase() === lowerKeyword;
      const bExact = b.label.toLowerCase() === lowerKeyword;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // 前缀匹配优先
      const aPrefix = a.label.toLowerCase().startsWith(lowerKeyword);
      const bPrefix = b.label.toLowerCase().startsWith(lowerKeyword);
      if (aPrefix && !bPrefix) return -1;
      if (!aPrefix && bPrefix) return 1;

      return 0;
    });

    return matched.slice(0, limit);
  }

  /**
   * 根据节点名搜索并跳转（便捷方法）
   * @param nodeName 节点名（支持带前缀或不带前缀）
   * @param options 搜索选项
   * @returns 跳转结果
   */
  async navigateToNodeByName(
    nodeName: string,
    options?: {
      /** 是否启用跨文件搜索 */
      crossFile?: boolean;
      /** 排除的节点类型 */
      excludeTypes?: NodeTypeEnum[];
    },
  ): Promise<{
    success: boolean;
    nodeInfo?: CrossFileNodeInfo;
    message?: string;
  }> {
    if (!nodeName.trim()) {
      return { success: false, message: "节点名为空" };
    }

    // 搜索匹配的节点
    const matchedNodes = this.searchNodes(nodeName, {
      crossFile: options?.crossFile ?? true,
      limit: 1,
      excludeTypes: options?.excludeTypes,
    });

    if (matchedNodes.length === 0) {
      return { success: false, message: `未找到节点: ${nodeName}` };
    }

    const nodeInfo = matchedNodes[0];
    const success = await this.navigateToNode(nodeInfo);

    return {
      success,
      nodeInfo,
      message: success
        ? nodeInfo.isCurrentFile
          ? `已定位到节点: ${nodeInfo.label}`
          : `已跳转到 ${nodeInfo.relativePath} 并定位节点: ${nodeInfo.label}`
        : "跳转失败",
    };
  }

  /**
   * 跳转到指定节点
   * @param nodeInfo 节点信息
   * @returns 是否成功
   */
  async navigateToNode(nodeInfo: CrossFileNodeInfo): Promise<boolean> {
    const fileStore = useFileStore.getState();

    // 如果是当前文件，直接定位
    if (nodeInfo.isCurrentFile) {
      return this.focusNodeInCurrentFile(nodeInfo.label);
    }

    // 如果已加载，切换文件并定位
    if (nodeInfo.isLoaded) {
      const targetFile = fileStore.files.find(
        (f) =>
          f.config.filePath === nodeInfo.filePath ||
          f.fileName === nodeInfo.filePath,
      );

      if (targetFile) {
        fileStore.switchFile(targetFile.fileName);
        // 等待切换完成后定位节点
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.focusNodeInCurrentFile(nodeInfo.label);
      }
    }

    // 未加载的本地文件，需要先加载
    if (this.isConnected()) {
      const success = await this.loadAndNavigate(
        nodeInfo.filePath,
        nodeInfo.label,
      );
      return success;
    }

    return false;
  }

  /**
   * 根据文件路径和节点标签跳转到指定节点（精确跳转）
   * 支持前端多 tab 场景下的跳转
   * @param filePath 文件路径或文件名
   * @param nodeLabel 节点标签
   * @returns 是否成功
   */
  async navigateToNodeByFileAndLabel(
    filePath: string,
    nodeLabel: string,
  ): Promise<boolean> {
    const fileStore = useFileStore.getState();
    const currentFile = fileStore.currentFile;

    // 检查是否是当前文件
    const isCurrentFile =
      currentFile.config.filePath === filePath ||
      currentFile.fileName === filePath;

    if (isCurrentFile) {
      return this.focusNodeInCurrentFile(nodeLabel);
    }

    // 查找目标文件
    const targetFile = fileStore.files.find(
      (f) => f.config.filePath === filePath || f.fileName === filePath,
    );

    if (targetFile) {
      // 切换文件
      fileStore.switchFile(targetFile.fileName);
      // 等待切换完成后定位节点
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.focusNodeInCurrentFile(nodeLabel);
    }

    // 文件未加载，尝试通过后端加载
    if (
      this.isConnected() &&
      (filePath.includes("/") || filePath.includes("\\"))
    ) {
      // 路径包含路径分隔符，说明是本地文件路径
      const success = await this.loadAndNavigate(filePath, nodeLabel);
      return success;
    }

    return false;
  }

  /**
   * 在当前文件中定位节点
   */
  private focusNodeInCurrentFile(label: string): boolean {
    const flowStore = useFlowStore.getState();
    const nodes = flowStore.nodes;
    const instance = flowStore.instance;

    const targetNode = nodes.find((n: NodeType) => n.data.label === label);
    if (!targetNode) {
      return false;
    }

    // 选中节点
    flowStore.updateNodes(
      nodes.map((node: NodeType) => ({
        type: "select" as const,
        id: node.id,
        selected: node.id === targetNode.id,
      })),
    );

    // 聚焦视图
    if (instance) {
      const { x, y } = getNodeAbsolutePosition(targetNode, nodes);
      const { width = 200, height = 100 } = targetNode.measured || {};
      instance.setCenter(x + width / 2, y + height / 2, {
        duration: 500,
        zoom: 1.5,
      });
    }

    return true;
  }

  /**
   * 加载文件并跳转到节点
   */
  private async loadAndNavigate(
    filePath: string,
    nodeLabel: string,
  ): Promise<boolean> {
    try {
      // 请求文件内容
      const success = localServer.send("/etl/open_file", {
        file_path: filePath,
      });

      if (!success) {
        console.warn("[loadAndNavigate] 请求文件失败");
        return false;
      }

      // 等待文件加载
      const fileStore = useFileStore.getState();
      const maxAttempts = 20; // 最多尝试20次
      const attemptInterval = 100; // 每次间隔100ms

      let targetFile:
        | ReturnType<typeof useFileStore.getState>["files"][number]
        | undefined;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, attemptInterval));

        const currentFiles = useFileStore.getState().files;
        targetFile = currentFiles.find((f) => f.config.filePath === filePath);

        if (targetFile) {
          break;
        }
      }

      if (targetFile) {
        fileStore.switchFile(targetFile.fileName);

        // 等待切换完成并轮询等待节点加载
        // 等待节点加载到 flowStore 中
        const maxNodeAttempts = 15; // 最多尝试15次
        const nodeAttemptInterval = 100; // 每次间隔100ms

        for (let i = 0; i < maxNodeAttempts; i++) {
          await new Promise((resolve) =>
            setTimeout(resolve, nodeAttemptInterval),
          );

          const flowStore = useFlowStore.getState();
          const nodes = flowStore.nodes;
          const targetNode = nodes.find(
            (n: NodeType) => n.data.label === nodeLabel,
          );

          // 找到节点，执行定位
          if (targetNode) {
            return this.focusNodeInCurrentFile(nodeLabel);
          }
        }

        // 超时仍未找到节点
        console.warn(
          `[loadAndNavigate] 节点 "${nodeLabel}" 超时未找到，当前节点列表:`,
          useFlowStore.getState().nodes.map((n: NodeType) => n.data.label),
        );
        return false;
      }

      console.warn("[loadAndNavigate] 文件加载超时");
      return false;
    } catch (error) {
      console.error("[loadAndNavigate] 异常:", error);
      return false;
    }
  }

  /**
   * 解析节点名获取文件和节点标签
   * 支持带前缀的节点名
   */
  parseNodeName(fullName: string): {
    prefix: string;
    label: string;
  } | null {
    // 在所有已知节点中查找
    const allNodes = this.getAllNodes();
    const exactMatch = allNodes.find((n) => n.fullName === fullName);

    if (exactMatch) {
      return {
        prefix: exactMatch.prefix,
        label: exactMatch.label,
      };
    }

    // 尝试在当前文件中按 label 查找
    const labelMatch = allNodes.find(
      (n) => n.label === fullName && n.isCurrentFile,
    );
    if (labelMatch) {
      return {
        prefix: labelMatch.prefix,
        label: labelMatch.label,
      };
    }

    return null;
  }

  /**
   * 根据节点标签获取完整节点名（带前缀）
   * @param label 节点标签
   * @param filePath 文件路径（可选，用于指定文件）
   */
  getFullNodeName(label: string, filePath?: string): string | null {
    const allNodes = this.getAllNodes();

    let targetNode: CrossFileNodeInfo | undefined;

    if (filePath) {
      targetNode = allNodes.find(
        (n) => n.label === label && n.filePath === filePath,
      );
    } else {
      // 优先当前文件
      targetNode = allNodes.find((n) => n.label === label && n.isCurrentFile);
      if (!targetNode) {
        targetNode = allNodes.find((n) => n.label === label);
      }
    }

    return targetNode?.fullName || null;
  }

  /**
   * 获取可用于自动完成的节点选项
   * @param excludeCurrentFileExternalAnchors 是否排除当前文件的外部/锚点节点
   */
  getAutoCompleteOptions(excludeCurrentFileExternalAnchors = true): Array<{
    value: string;
    label: string;
    description: string;
    nodeInfo: CrossFileNodeInfo;
  }> {
    let allNodes = this.getAllNodes();

    // 排除当前文件的外部和锚点节点（因为这些是引用其他文件的）
    if (excludeCurrentFileExternalAnchors) {
      allNodes = allNodes.filter(
        (n) =>
          !(
            n.isCurrentFile &&
            (n.nodeType === NodeTypeEnum.External ||
              n.nodeType === NodeTypeEnum.Anchor)
          ),
      );
    }

    // 只保留 Pipeline 类型节点用于 External/Anchor 的自动完成
    allNodes = allNodes.filter((n) => n.nodeType === NodeTypeEnum.Pipeline);

    return allNodes.map((n) => ({
      value: n.fullName, // 总是使用带前缀的完整节点名
      label: n.fullName, // 显示完整节点名
      description: n.isCurrentFile ? "当前文件" : n.relativePath,
      nodeInfo: n,
    }));
  }

  /**
   * 获取跨文件的 anchor 引用信息
   * @param anchorName anchor 名称
   * @returns 引用该 anchor 的节点列表
   */
  getAnchorReferencesCrossFile(anchorName: string): Array<{
    id: string;
    label: string;
    filePath: string;
    relativePath: string;
    isCurrentFile: boolean;
    isLoaded: boolean;
  }> {
    const result: Array<{
      id: string;
      label: string;
      filePath: string;
      relativePath: string;
      isCurrentFile: boolean;
      isLoaded: boolean;
    }> = [];

    const currentFile = useFileStore.getState().currentFile;
    const files = useFileStore.getState().files;
    const localFiles = useLocalFileStore.getState().files;
    const isConnected = this.isConnected();

    // 处理已加载的文件，排除当前文件
    for (const file of files) {
      // 跳过当前文件
      if (file.fileName === currentFile.fileName) continue;

      const filePath = file.config.filePath || file.fileName;
      const relativePath = file.config.relativePath || file.fileName;

      for (const node of file.nodes) {
        // 只处理 Pipeline 节点
        if (node.type !== NodeTypeEnum.Pipeline) continue;

        const anchorValue =
          "others" in node.data ? node.data.others?.anchor : undefined;
        if (this.anchorValueContains(anchorValue, anchorName)) {
          result.push({
            id: node.id,
            label: node.data.label,
            filePath,
            relativePath,
            isCurrentFile: false,
            isLoaded: true,
          });
        }
      }
    }

    // 处理未加载的本地文件
    if (isConnected) {
      for (const localFile of localFiles) {
        // 跳过已加载的文件
        const isLoaded = files.some(
          (f) => f.config.filePath === localFile.file_path,
        );
        if (isLoaded) continue;

        // 从 localFile.nodes 中查找引用了目标 anchor 的节点
        for (const nodeInfo of localFile.nodes || []) {
          // 检查节点的 anchors 列表是否包含目标 anchor
          if (nodeInfo.anchors && nodeInfo.anchors.includes(anchorName)) {
            // 从 label 中提取真正的节点名
            let label = nodeInfo.label;
            const nodePrefix = nodeInfo.prefix || localFile.prefix;
            if (nodePrefix && label.startsWith(nodePrefix + "_")) {
              label = label.slice(nodePrefix.length + 1);
            }

            result.push({
              id: `${localFile.file_path}#${nodeInfo.label}`, // 使用文件路径+节点名作为临时ID
              label,
              filePath: localFile.file_path,
              relativePath: localFile.relative_path,
              isCurrentFile: false,
              isLoaded: false,
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * 检查 anchor 字段值是否包含指定的 anchor 名称
   */
  private anchorValueContains(
    anchorValue: unknown,
    anchorName: string,
  ): boolean {
    if (!anchorValue) return false;

    if (typeof anchorValue === "string") {
      return anchorValue === anchorName;
    }

    if (Array.isArray(anchorValue)) {
      return anchorValue.some(
        (item) => typeof item === "string" && item === anchorName,
      );
    }

    if (typeof anchorValue === "object") {
      return Object.keys(anchorValue).includes(anchorName);
    }

    return false;
  }
}

// 导出单例
export const crossFileService = new CrossFileService();
