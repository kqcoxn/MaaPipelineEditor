import { Modal } from "antd";
import { parse as parseJsonc, visit } from "jsonc-parser";
import {
  useFlowStore,
  createPipelineNode,
  createExternalNode,
  createAnchorNode,
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
import { externalMarkPrefix, anchorMarkPrefix } from "./types";
import { parsePipelineConfig, isMark } from "./configParser";
import { detectNodeVersion } from "./versionDetector";
import {
  linkEdge,
  getNextId,
  type NodeRefType,
  type NodeAttr,
} from "./edgeLinker";
import { parseNodeField } from "./nodeParser";

/**
 * 迁移 Pipeline v5.1 废弃字段
 */
function migratePipelineV5(
  pipelineObj: Record<string, unknown>,
  objKeys: string[]
): void {
  const JUMPBACK_PREFIX = "[JumpBack]";
  const subNodes = new Set<string>();
  for (const objKey of objKeys) {
    const obj = pipelineObj[objKey];
    if (
      obj &&
      typeof obj === "object" &&
      (obj as Record<string, unknown>)["is_sub"] === true
    ) {
      subNodes.add(objKey);
    }
  }

  for (const objKey of objKeys) {
    const obj = pipelineObj[objKey] as Record<string, unknown> | undefined;
    if (!obj || typeof obj !== "object") continue;

    // 处理 interrupt 字段
    if ("interrupt" in obj) {
      const interrupt = obj["interrupt"];
      let interruptNodes: NodeRefType[] = [];

      if (typeof interrupt === "string") {
        interruptNodes = [interrupt];
      } else if (Array.isArray(interrupt)) {
        interruptNodes = interrupt;
      }

      if (interruptNodes.length > 0) {
        // [JumpBack] 前缀
        const prefixedInterruptNodes = interruptNodes.map((n) => {
          if (typeof n === "string") {
            return n.startsWith(JUMPBACK_PREFIX) ? n : `${JUMPBACK_PREFIX}${n}`;
          } else if (typeof n === "object" && n !== null) {
            // 对象形式，添加 jump_back 属性
            return { ...n, jump_back: true };
          }
          return n;
        });

        // 合并到 next
        let currentNext: NodeRefType[] = [];
        if (obj["next"]) {
          if (typeof obj["next"] === "string") {
            currentNext = [obj["next"]];
          } else if (Array.isArray(obj["next"])) {
            currentNext = obj["next"];
          }
        }
        obj["next"] = [...currentNext, ...prefixedInterruptNodes];
      }

      // 删除 interrupt 字段
      delete obj["interrupt"];
    }

    // 处理 next 和 on_error 中对 is_sub 节点的引用
    const processRefs = (field: string) => {
      if (!(field in obj)) return;
      const refs = obj[field];
      let refArray: NodeRefType[] = [];

      if (typeof refs === "string") {
        refArray = [refs];
      } else if (Array.isArray(refs)) {
        refArray = refs;
      }

      if (refArray.length > 0) {
        obj[field] = refArray.map((n) => {
          // 字符串形式
          if (typeof n === "string") {
            if (subNodes.has(n) && !n.startsWith(JUMPBACK_PREFIX)) {
              return `${JUMPBACK_PREFIX}${n}`;
            }
            return n;
          }
          // 对象形式
          if (typeof n === "object" && n !== null) {
            const nodeName = (n as NodeAttr).name;
            if (nodeName && subNodes.has(nodeName)) {
              return { ...n, jump_back: true };
            }
            return n;
          }
          return n;
        });
      }
    };

    processRefs("next");
    processRefs("on_error");

    // 删除 is_sub 字段
    if ("is_sub" in obj) {
      delete obj["is_sub"];
    }
  }
}

/**
 * 将Pipeline对象导入为Flow
 * @param options 导入选项，可以传入Pipeline字符串
 */
export async function pipelineToFlow(
  options?: PipelineToFlowOptions
): Promise<boolean> {
  try {
    // 获取参数
    let pString = options?.pString ?? (await ClipboardHelper.read());

    // 处理空文件或只包含空格的文件
    const trimmedString = pString.trim();
    if (trimmedString === "") {
      pString = "{}";
    }

    // 获取键顺序
    const keyOrder: string[] = [];
    let currentDepth = 0;
    visit(
      pString,
      {
        onObjectBegin: () => {
          currentDepth++;
        },
        onObjectEnd: () => {
          currentDepth--;
        },
        onObjectProperty: (property) => {
          // 只记录顶层属性
          if (currentDepth === 1) {
            keyOrder.push(property);
          }
        },
      },
      { allowTrailingComma: true }
    );

    const pipelineObj = parseJsonc(pString);

    // 解析配置
    const configs = parsePipelineConfig(pipelineObj);

    // 迁移废弃字段
    const objKeys = keyOrder.length > 0 ? keyOrder : Object.keys(pipelineObj);
    migratePipelineV5(pipelineObj, objKeys);

    // 解析节点
    let nodes: NodeType[] = [];
    const originLabels: string[] = [];
    const originalKeys: string[] = [];
    let idOLPairs: IdLabelPairsType = [];
    let isIncludePos = false;

    // 初始化顺序映射
    const orderMap: Record<string, number> = {};
    let nextOrder = 0;

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

      // 分配顺序号
      orderMap[id] = nextOrder++;

      // 判断是否为外部节点或重定向节点
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
      } else if (objKey.startsWith(anchorMarkPrefix)) {
        type = NodeTypeEnum.Anchor;
        label = label.substring(anchorMarkPrefix.length);
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
          : type === NodeTypeEnum.External
          ? (createExternalNode(id, { label }) as PipelineNodeType)
          : (createAnchorNode(id, { label }) as PipelineNodeType);

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

    // 保存顺序映射
    setFileConfig("nodeOrderMap", orderMap);
    setFileConfig("nextOrderNumber", nextOrder);

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
