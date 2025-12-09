import { notification } from "antd";
import { useFlowStore, findNodeLabelById } from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import { globalConfig, useConfigStore } from "../../stores/configStore";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
} from "../../components/flow/nodes";
import type {
  FlowToOptions,
  PipelineObjType,
  NodeType,
  EdgeType,
  PipelineNodeType,
} from "./types";
import { configMarkPrefix, externalMarkPrefix, configMark } from "./types";
import type { NodeAttr } from "./edgeLinker";
import {
  parsePipelineNodeForExport,
  parseExternalNodeForExport,
} from "./nodeParser";

/**
 * 将Flow转换为Pipeline对象
 * @param datas 可选的数据，包含节点、边、文件名、配置
 * @returns Pipeline对象
 */
export function flowToPipeline(datas?: FlowToOptions): PipelineObjType {
  try {
    // 获取当前 flow 数据
    const flowState = useFlowStore.getState();
    const fileState = useFileStore.getState();
    const { nodes, edges, config, fileName } = {
      nodes: datas?.nodes ?? (flowState.nodes as NodeType[]),
      edges: datas?.edges ?? (flowState.edges as EdgeType[]),
      fileName: datas?.fileName ?? fileState.currentFile.fileName,
      config: datas?.config ?? fileState.currentFile.config,
    };
    const generalConfig = useConfigStore.getState().configs;

    // 生成节点
    const prefix = config.prefix ? config.prefix + "_" : "";
    const pipelineObj: PipelineObjType = {};

    nodes.forEach((node) => {
      switch (node.type) {
        case NodeTypeEnum.Pipeline:
          pipelineObj[prefix + node.data.label] = parsePipelineNodeForExport(
            node as PipelineNodeType
          );
          break;
        case NodeTypeEnum.External:
          if (!generalConfig.isExportConfig) break;
          pipelineObj[externalMarkPrefix + node.data.label + "_" + fileName] =
            parseExternalNodeForExport(node as PipelineNodeType);
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
      // 判断是否有 jump_back 属性
      const hasJumpBack = edge.sourceHandle === SourceHandleTypeEnum.JumpBack;

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
      const linkType =
        edge.sourceHandle === SourceHandleTypeEnum.JumpBack
          ? SourceHandleTypeEnum.Next
          : (edge.sourceHandle as SourceHandleTypeEnum);
      if (!(linkType in pSourceNode)) pSourceNode[linkType] = [];
      pSourceNode[linkType].push(toPNodeRef);
    });

    // 配置
    if (!generalConfig.isExportConfig) return pipelineObj;
    return {
      [configMarkPrefix + fileName]: {
        [configMark]: {
          ...config,
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
