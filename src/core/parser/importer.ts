import React from "react";
import { Modal } from "antd";
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
import { linkEdge, getNextId, type NodeRefType } from "./edgeLinker";
import { parseNodeField } from "./nodeParser";

/**
 * 将Pipeline对象导入为Flow
 * @param options 导入选项，可以传入Pipeline字符串
 */
export async function pipelineToFlow(
  options?: PipelineToFlowOptions
): Promise<boolean> {
  try {
    // 获取参数
    const pString = options?.pString ?? (await ClipboardHelper.read());
    const pipelineObj = parseJsonc(pString);

    // 解析配置
    const configs = parsePipelineConfig(pipelineObj);

    // 检测废弃字段
    let hasDeprecatedFields = false;
    const objKeys = Object.keys(pipelineObj);
    for (const objKey of objKeys) {
      const obj = pipelineObj[objKey];
      if (obj && typeof obj === "object") {
        if ("interrupt" in obj || "is_sub" in obj) {
          hasDeprecatedFields = true;
          break;
        }
      }
    }
    if (hasDeprecatedFields) {
      Modal.error({
        title: "导入失败：检测到已废弃字段",
        content: React.createElement(
          "div",
          null,
          React.createElement(
            "p",
            null,
            "MFW v5.1 后已废除 interrupt 与 is_sub 字段。"
          ),
          React.createElement("p", null, "请使用以下方式之一处理："),
          React.createElement(
            "ol",
            { style: { paddingLeft: "20px", marginTop: "8px" } },
            React.createElement(
              "li",
              { style: { marginBottom: "8px" } },
              "使用官方提供的升级脚本进行迁移：",
              React.createElement("br"),
              React.createElement(
                "a",
                {
                  href: "https://github.com/MaaXYZ/MaaFramework/blob/main/tools/migrate_pipeline_v5.py",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: { color: "#1890ff" },
                },
                "migrate_pipeline_v5.py"
              )
            ),
            React.createElement(
              "li",
              null,
              "在 MPE 导航栏版本选择下拉菜单使用旧版快照"
            )
          )
        ),
        width: 500,
      });
      return false;
    }

    // 解析节点
    let nodes: NodeType[] = [];
    const originLabels: string[] = [];
    const originalKeys: string[] = [];
    let idOLPairs: IdLabelPairsType = [];
    let isIncludePos = false;

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
      const next = obj["next"] as NodeRefType[];
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

      // 解析 on_error 连接
      const onError = obj["on_error"] as NodeRefType[];
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

    return true;
  } catch (err) {
    Modal.error({
      title: "导入失败！",
      content:
        "请检查pipeline格式是否正确，或版本是否一致，详细程序错误请在控制台查看。",
    });
    console.error(err);
    return false;
  }
}
