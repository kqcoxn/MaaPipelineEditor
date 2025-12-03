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
    edges.forEach((edge) => {
      // 获取节点数据
      const sourceKey = findNodeLabelById(nodes, edge.source);
      const pSourceNode = pipelineObj[prefix + sourceKey];
      if (!pSourceNode) return;
      const targetKey = findNodeLabelById(nodes, edge.target);
      const targetNode = nodes.find((n) => n.id === edge.target);
      const pTargetNode = pipelineObj[prefix + targetKey];
      // 添加链接
      let toPNodeKey = pTargetNode ? prefix + targetKey : targetKey;
      // [Anchor] 节点
      if (targetNode?.type === NodeTypeEnum.Anchor) {
        toPNodeKey = `[Anchor]${targetKey}`;
      }
      const linkType = edge.sourceHandle as SourceHandleTypeEnum;
      if (!(linkType in pSourceNode)) pSourceNode[linkType] = [];
      pSourceNode[linkType].push(toPNodeKey);
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
