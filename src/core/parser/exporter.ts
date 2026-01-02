import { notification } from "antd";
import { useFlowStore, findNodeLabelById } from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import { globalConfig, useConfigStore } from "../../stores/configStore";
import { ErrorTypeEnum, findErrorsByType } from "../../stores/errorStore";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../components/flow/nodes";
import type {
  FlowToOptions,
  PipelineObjType,
  NodeType,
  EdgeType,
  PipelineNodeType,
} from "./types";
import {
  configMarkPrefix,
  externalMarkPrefix,
  anchorMarkPrefix,
  configMark,
} from "./types";
import type { NodeAttr } from "./edgeLinker";
import {
  parsePipelineNodeForExport,
  parseExternalNodeForExport,
  parseAnchorNodeForExport,
} from "./nodeParser";
import { normalizeViewport } from "../../stores/flow/utils/viewportUtils";
import { splitPipelineAndConfig } from "./configSplitter";

/**
 * 将Flow转换为Pipeline对象
 * @param datas 可选的数据，包含节点、边、文件名、配置
 * @returns Pipeline对象
 */
export function flowToPipeline(datas?: FlowToOptions): PipelineObjType {
  try {
    // 检查是否有节点名重复错误
    const repeatErrors = findErrorsByType(ErrorTypeEnum.NodeNameRepeat);
    if (repeatErrors.length > 0) {
      notification.error({
        message: "导出失败！",
        description: `存在重复的节点名: ${repeatErrors
          .map((e) => e.msg)
          .join(", ")}，请修改后再试。`,
        placement: "top",
      });
      return {};
    }

    // 获取当前 flow 数据
    const flowState = useFlowStore.getState();
    const fileState = useFileStore.getState();
    const { nodes, edges, config, fileName, forceExportConfig } = {
      nodes: datas?.nodes ?? (flowState.nodes as NodeType[]),
      edges: datas?.edges ?? (flowState.edges as EdgeType[]),
      fileName: datas?.fileName ?? fileState.currentFile.fileName,
      config: datas?.config ?? fileState.currentFile.config,
      forceExportConfig: datas?.forceExportConfig,
    };
    const generalConfig = useConfigStore.getState().configs;

    // forceExportConfig > configHandlingMode
    const shouldExportConfig =
      forceExportConfig !== undefined
        ? forceExportConfig
        : generalConfig.configHandlingMode !== "none";

    // 按顺序排序节点
    const orderMap = config.nodeOrderMap ?? {};
    const sortedNodes = [...nodes].sort((a, b) => {
      const orderA = orderMap[a.id] ?? Infinity;
      const orderB = orderMap[b.id] ?? Infinity;
      return orderA - orderB;
    });

    // 生成节点
    const prefix = config.prefix ? config.prefix + "_" : "";
    const pipelineObj: PipelineObjType = {};

    sortedNodes.forEach((node) => {
      switch (node.type) {
        case NodeTypeEnum.Pipeline:
          pipelineObj[prefix + node.data.label] = parsePipelineNodeForExport(
            node as PipelineNodeType
          );
          break;
        case NodeTypeEnum.External:
          if (!shouldExportConfig) break;
          pipelineObj[externalMarkPrefix + node.data.label + "_" + fileName] =
            parseExternalNodeForExport(node as PipelineNodeType);
          break;
        case NodeTypeEnum.Anchor:
          if (!shouldExportConfig) break;
          pipelineObj[anchorMarkPrefix + node.data.label + "_" + fileName] =
            parseAnchorNodeForExport(node as PipelineNodeType);
          break;
      }
    });

    // 链接
    const sortedEdges = [...edges].sort((a, b) => {
      if (a.source === b.source) {
        return (a.label as number) - (b.label as number);
      }
      return 0;
    });

    sortedEdges.forEach((edge) => {
      // 获取节点数据
      const sourceKey = findNodeLabelById(nodes, edge.source);
      const pSourceNode = pipelineObj[prefix + sourceKey];
      if (!pSourceNode) return;
      const targetKey = findNodeLabelById(nodes, edge.target);
      if (!targetKey) return;
      const targetNode = nodes.find((n) => n.id === edge.target);
      const pTargetNode = pipelineObj[prefix + targetKey];

      // 判断是否是 Anchor 节点或有 anchor 属性
      const isAnchor =
        targetNode?.type === NodeTypeEnum.Anchor || edge.attributes?.anchor;
      const hasJumpBack =
        edge.targetHandle === TargetHandleTypeEnum.JumpBack ||
        edge.attributes?.jump_back;

      // 构建目标节点引用
      let toPNodeRef: string | NodeAttr;
      const nodeName = pTargetNode ? prefix + targetKey : targetKey;

      if (isAnchor || hasJumpBack) {
        // 导出形式
        if (generalConfig.nodeAttrExportStyle === "prefix") {
          // 使用前缀形式
          let prefixStr = "";
          if (isAnchor) prefixStr += "[Anchor]";
          if (hasJumpBack) prefixStr += "[JumpBack]";
          toPNodeRef = prefixStr + nodeName;
        } else {
          // 使用对象形式
          const nodeAttr: NodeAttr = { name: nodeName };
          if (isAnchor) nodeAttr.anchor = true;
          if (hasJumpBack) nodeAttr.jump_back = true;
          toPNodeRef = nodeAttr;
        }
      } else {
        // 使用简单字符串形式
        toPNodeRef = nodeName;
      }

      // 添加链接
      const linkType = edge.sourceHandle as SourceHandleTypeEnum;
      if (!(linkType in pSourceNode)) pSourceNode[linkType] = [];
      pSourceNode[linkType].push(toPNodeRef);
    });

    // 配置
    if (!shouldExportConfig) return pipelineObj;
    // 过滤掉运行时字段
    const { nodeOrderMap, nextOrderNumber, savedViewport, ...exportConfig } =
      config;
    // 对 savedViewport 的值取整
    const normalizedViewport = normalizeViewport(savedViewport);
    return {
      [configMarkPrefix + fileName]: {
        [configMark]: {
          ...exportConfig,
          ...(normalizedViewport && { savedViewport: normalizedViewport }),
          filename: fileState.currentFile.fileName,
          version: `v${globalConfig.version}`,
        },
      },
      ...pipelineObj,
    };
  } catch (err) {
    notification.error({
      title: "导出失败！",
      description: "请检查个节点字段是否符合格式，详细程序错误请在控制台查看",
      placement: "top",
    });
    console.error(err);
    return {};
  }
}

/**
 * 将Flow转换为Pipeline JSON字符串
 * @param datas 可选的数据，包含节点、边、文件名、配置
 * @returns Pipeline JSON字符串
 */
export function flowToPipelineString(datas?: FlowToOptions): string {
  const pipelineObj = flowToPipeline(datas);
  return JSON.stringify(pipelineObj, null, 2);
}

/**
 * 生成分离模式的导出内容
 * @param datas 可选的数据
 * @returns { pipelineString, configString } 两个 JSON 字符串
 */
export function flowToSeparatedStrings(datas?: FlowToOptions): {
  pipelineString: string;
  configString: string;
} {
  // 生成完整的 Pipeline 对象
  const fullPipelineObj = flowToPipeline({ ...datas, forceExportConfig: true });

  // 拆分为 Pipeline 和配置
  const { pipeline, config } = splitPipelineAndConfig(fullPipelineObj);

  return {
    pipelineString: JSON.stringify(pipeline, null, 2),
    configString: JSON.stringify(config, null, 2),
  };
}
