import { notification } from "antd";
import { parse as parseJsonc } from "jsonc-parser";
import {
  useFlowStore,
  createPipelineNode,
  createExternalNode,
} from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
} from "../../components/flow/nodes";
import { ClipboardHelper } from "../../utils/clipboard";
import { LayoutHelper } from "../layout";
import type {
  PipelineToFlowOptions,
  NodeType,
  EdgeType,
  IdLabelPairsType,
  PipelineNodeType,
} from "./types";
import { externalMarkPrefix } from "./types";
import { parsePipelineConfig, isMark } from "./configParser";
import { detectNodeVersion } from "./versionDetector";
import { linkEdge, getNextId } from "./edgeLinker";
import { parseNodeField } from "./nodeParser";

/**
 * 将Pipeline对象导入为Flow
 * @param options 导入选项，可以传入Pipeline字符串
 */
export async function pipelineToFlow(options?: PipelineToFlowOptions) {
  try {
    // 获取参数
    const pString = options?.pString ?? (await ClipboardHelper.read());
    const pipelineObj = parseJsonc(pString);

    // 解析配置
    const configs = parsePipelineConfig(pipelineObj);

    // 解析节点
    let nodes: NodeType[] = [];
    const originLabels: string[] = [];
    const originalKeys: string[] = [];
    let idOLPairs: IdLabelPairsType = [];
    let isIncludePos = false;

    const objKeys = Object.keys(pipelineObj);
    objKeys.forEach((objKey) => {
      const obj = pipelineObj[objKey];

      // 跳过配置键
      if (
        objKey.startsWith("$__mpe_config_") ||
        objKey.startsWith("__mpe_config_") ||
        objKey.startsWith("__yamaape_config_")
      ) {
        return;
      }

      // 检测当前节点的版本
      const { recognitionVersion, actionVersion } = detectNodeVersion(obj);

      // 处理节点名
      const id = "p_" + getNextId();
      let label = objKey;

      // 判断是否为外部节点
      let type = NodeTypeEnum.Pipeline;
      if (objKey.startsWith(externalMarkPrefix)) {
        type = NodeTypeEnum.External;
        label = label.substring(externalMarkPrefix.length);
        const filename = configs.filename;
        if (filename) {
          label = label.substring(0, label.length - filename.length - 1);
        }
        originLabels.push(label);
        originalKeys.push(objKey);
        idOLPairs.push({ id, label });
      } else {
        originLabels.push(label);
        originalKeys.push(objKey);
        idOLPairs.push({ id, label });
        // 删除前缀
        const prefix = configs.prefix;
        if (prefix) {
          label = label.substring(prefix.length + 1);
        }
      }

      // 创建节点
      const node =
        type === NodeTypeEnum.Pipeline
          ? createPipelineNode(id, { label })
          : (createExternalNode(id, { label }) as PipelineNodeType);

      // 解析节点字段
      const keys = Object.keys(obj);
      keys.forEach((key) => {
        const value = obj[key];

        // 标记字段 - 包含位置信息
        if (isMark(key)) {
          Object.assign(node, value);
          isIncludePos = true;
          return;
        }

        // 解析其他字段
        const isHandled = parseNodeField(
          node,
          key,
          value,
          recognitionVersion,
          actionVersion
        );

        // 如果字段未被处理，作为额外字段
        if (!isHandled) {
          node.data.extras[key] = value;
        }
      });

      // 检查Pipeline节点参数完整性
      if (type === NodeTypeEnum.Pipeline) {
        node.data.recognition.param ??= {};
        node.data.action.param ??= {};
      }

      // 保存节点
      nodes.push(node);
    });

    // 解析连接
    let edges: EdgeType[] = [];
    for (let index = 0; index < originLabels.length; index++) {
      const objKey = originalKeys[index];
      const obj = pipelineObj[objKey];
      if (!obj) continue;
      const originLabel = originLabels[index];

      // 解析 next 连接
      const next = obj["next"] as string[];
      if (next) {
        const [newEdges, newNodes, newIdOLPairs] = linkEdge(
          originLabel,
          next,
          SourceHandleTypeEnum.Next,
          idOLPairs
        );
        if (newEdges.length > 0) edges = edges.concat(newEdges);
        if (newNodes.length > 0) nodes = nodes.concat(newNodes);
        if (newIdOLPairs.length > 0) idOLPairs = idOLPairs.concat(newIdOLPairs);
      }

      // 解析 interrupt 连接
      const interrupt = obj["interrupt"] as string[];
      if (interrupt) {
        const [newEdges, newNodes, newIdOLPairs] = linkEdge(
          originLabel,
          interrupt,
          SourceHandleTypeEnum.Interrupt,
          idOLPairs
        );
        if (newEdges.length > 0) edges = edges.concat(newEdges);
        if (newNodes.length > 0) nodes = nodes.concat(newNodes);
        if (newIdOLPairs.length > 0) idOLPairs = idOLPairs.concat(newIdOLPairs);
      }

      // 解析 on_error 连接
      const onError = obj["on_error"] as string[];
      if (onError) {
        const [newEdges, newNodes, newIdOLPairs] = linkEdge(
          originLabel,
          onError,
          SourceHandleTypeEnum.Error,
          idOLPairs
        );
        if (newEdges.length > 0) edges = edges.concat(newEdges);
        if (newNodes.length > 0) nodes = nodes.concat(newNodes);
        if (newIdOLPairs.length > 0) idOLPairs = idOLPairs.concat(newIdOLPairs);
      }
    }

    // 更新flow
    useFlowStore.getState().replace(nodes, edges, { isFitView: isIncludePos });

    // 初始化历史记录
    useFlowStore.getState().initHistory(nodes, edges);

    // 更新文件配置
    const fileState = useFileStore.getState();
    if (configs.filename) fileState.setFileName(configs.filename);
    const setFileConfig = fileState.setFileConfig;
    if (configs.prefix) setFileConfig("prefix", configs.prefix);

    // 自动布局
    if (!isIncludePos) LayoutHelper.auto();
  } catch (err) {
    notification.error({
      message: "导入失败！",
      description:
        "请检查pipeline格式是否正确，或版本是否一致，详细程序错误请在控制台查看",
      placement: "top",
    });
    console.error(err);
  }
}
