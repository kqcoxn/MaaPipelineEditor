import { notification } from "antd";
import { flatten } from "lodash";
import { parse as parseJsonc } from "jsonc-parser";

import {
  useFlowStore,
  findNodeLabelById,
  createPipelineNode,
  createExternalNode,
  type NodeType,
  type EdgeType,
  type PipelineNodeType,
  type RecognitionParamType,
  type ActionParamType,
  type OtherParamType,
  type ParamType,
} from "../stores/flowStore";
import { useFileStore, type FileConfigType } from "../stores/fileStore";
import { globalConfig, useConfigStore } from "../stores/configStore";
import {
  FieldTypeEnum,
  recoFields,
  actionFields,
  otherFieldParams,
  recoFieldSchemaKeyList,
  actionFieldSchemaKeyList,
  otherFieldSchemaKeyList,
  upperRecoValues,
  upperActionValues,
  type FieldType,
} from "./fields";
import { NodeTypeEnum, SourceHandleTypeEnum } from "../components/flow/nodes";
import { JsonHelper } from "../utils/jsonHelper";
import { ClipboardHelper } from "../utils/clipboard";
import { LayoutHelper } from "./layout";

export const configMark = "$__mpe_code";
export const configMarkPrefix = "$__mpe_config_";
export const externalMarkPrefix = "$__mpe_external_";
type ParsedPipelineNodeType = {
  [configMark]?: {
    position: { x: number; y: number };
  };
  recognition?: {
    type: "TemplateMatch";
    param: RecognitionParamType;
  };
  action?: {
    type: "TemplateMatch";
    param: ActionParamType;
  };
  [SourceHandleTypeEnum.Next]?: string[];
  [SourceHandleTypeEnum.Interrupt]?: string[];
  [SourceHandleTypeEnum.Error]?: string[];
} & OtherParamType &
  any;
export type PipelineObjType = Record<string, ParsedPipelineNodeType>;

/**转录为 PipelineObj */
// 数据匹配
function puraStringList(list: any): string[] {
  return String(list)
    .replace(/[\s\[\]]/g, "")
    .split(/[,，]/);
}
function matchParamType(params: ParamType, types: FieldType[]): ParamType {
  const paramKeys = Object.keys(params);
  const matchedDatas: any = {};
  paramKeys.forEach((key) => {
    // 检查参数是否预定义
    const type = types.find((type) => type.key === key);
    if (!type) {
      matchedDatas[key] = params[key];
      return;
    }
    // 匹配参数类型
    const typeList = Array.isArray(type.type) ? type.type : [type.type];
    const value = params[key];
    let matchedValue = null;
    for (const type of typeList) {
      let temp = null;
      try {
        if (matchedValue !== null) break;
        switch (type) {
          // 整型
          case FieldTypeEnum.Int:
            temp = Number(value);
            if (Number.isInteger(temp)) {
              matchedValue = temp;
            }
            break;
          // 浮点数
          case FieldTypeEnum.Double:
            temp = Number(value);
            if (!Number.isNaN(temp)) {
              matchedValue = temp;
            }
            break;
          // True
          case FieldTypeEnum.True:
            if (String(value) === "true") {
              matchedValue = true;
            }
            break;
          // 布尔
          case FieldTypeEnum.Bool:
            switch (String(value)) {
              case "true":
                matchedValue = true;
                break;
              case "false":
                matchedValue = false;
                break;
            }
            break;
          // 字符串
          case FieldTypeEnum.String:
            matchedValue = String(value);
            break;
          // 整型数组
          case FieldTypeEnum.IntList:
            if (Array.isArray(value)) {
              temp = value.map((item) => Number(item));
              if (temp.every((n) => Number.isInteger(n))) {
                matchedValue = temp;
              }
            }
            break;
          // 二维整型数组
          case FieldTypeEnum.IntListList:
            if (Array.isArray(value)) {
              const number2DList: any[] = [];
              let length = 0;
              for (let list of value) {
                temp = puraStringList(list).map((c) => Number(c));
                if (length === 0) length = temp.length;
                if (
                  temp.length !== length ||
                  temp.some((n) => !Number.isInteger(n))
                ) {
                  length = 0;
                  break;
                }
                number2DList.push(temp);
              }
              if (length > 0) {
                matchedValue =
                  length === 1 ? flatten(number2DList) : number2DList;
              }
            }
            break;
          // 浮点数数组
          case FieldTypeEnum.DoubleList:
            if (Array.isArray(value)) {
              temp = value.map((item) => Number(item));
              if (temp.every((n) => !Number.isNaN(n))) {
                matchedValue = temp;
              }
            }
            break;
          // 字符串数组
          case FieldTypeEnum.StringList:
            if (Array.isArray(value)) {
              matchedValue = value.map((item) => String(item));
            }
            break;
          // XYWH
          case FieldTypeEnum.XYWH:
            temp = puraStringList(value).map((c) => Number(c));
            if (temp.length === 4 && temp.every((n) => Number.isInteger(n))) {
              matchedValue = temp;
            }
            break;
          // XYWH数组
          case FieldTypeEnum.XYWHList:
            if (Array.isArray(value)) {
              // [x,y,w,h] -> [[x,y,w,h]]
              const allInt = value.every((n) => Number.isInteger(Number(n)));
              if (value.length === 4 && allInt) {
                matchedValue = [value.map((n) => Number(n))];
                break;
              }
              // 每一项为 XYWH
              const list: any[] = [];
              let ok = true;
              for (const item of value) {
                const nums = puraStringList(item).map((c) => Number(c));
                if (nums.length === 4 && nums.every((n) => Number.isInteger(n)))
                  list.push(nums);
                else {
                  ok = false;
                  break;
                }
              }
              if (ok) matchedValue = list;
            } else {
              // XYWH 字符串
              const nums = puraStringList(value).map((c) => Number(c));
              if (nums.length === 4 && nums.every((n) => Number.isInteger(n))) {
                matchedValue = [nums];
              }
            }
            break;
          // 位置数组
          case FieldTypeEnum.PositionList:
            const buildPosition = (pos: any) => {
              // true
              if (pos === true || String(pos) === "true") return true;
              // [x,y,w,h] or [x,y]
              let nums = puraStringList(pos).map((c) => Number(c));
              if (
                (nums.length === 4 || nums.length === 2) &&
                nums.every((n) => Number.isInteger(n))
              )
                return nums;
              // label string
              return String(pos);
            };
            if (Array.isArray(value)) {
              const allInt = value.every((n) => Number.isInteger(Number(n)));
              if (value.length === 4 && allInt) {
                matchedValue = [value.map((n) => Number(n))];
                break;
              }
              const list: any[] = [];
              for (const item of value) {
                list.push(buildPosition(item));
              }
              matchedValue = list;
            } else {
              matchedValue = [buildPosition(value)];
            }
            break;
          // 整型键值对
          case FieldTypeEnum.IntPair:
            temp = puraStringList(value).map((c) => Number(c));
            if (temp.length === 2 && temp.every((n) => Number.isInteger(n))) {
              matchedValue = temp;
            }
            break;
          // 键值对
          case FieldTypeEnum.StringPair:
            temp = String(value)
              .replaceAll(/[" \[\]]/g, "")
              .split(",");
            if (temp.length === 2) {
              matchedValue = temp;
            }
            break;
          // 键值对数组
          case FieldTypeEnum.StringPairList:
            if (Array.isArray(value)) {
              const stringPairList: any[] = [];
              for (let pair of value) {
                if (Array.isArray(pair) && pair.length === 2) {
                  stringPairList.push(pair.map((s) => String(s)));
                  continue;
                }
                temp = String(pair)
                  .replaceAll(/[" \[\]]/g, "")
                  .split(",");
                if (temp.length === 2) {
                  stringPairList.push(temp);
                }
              }
              matchedValue = stringPairList;
            }
            break;
          // Any
          case FieldTypeEnum.Any:
            if (JsonHelper.isObj(value)) matchedValue = value;
            else {
              temp = String(value).replaceAll(/[“”]/g, `"`);
              matchedValue = JsonHelper.stringObjToJson(temp) ?? temp;
            }
            break;
          // ObjectList
          case FieldTypeEnum.ObjectList:
            if (Array.isArray(value)) {
              const objList = [];
              for (let obj of value) {
                if (JsonHelper.isObj(obj)) objList.push(obj);
                else {
                  temp = String(obj).replaceAll(/[“”]/g, `"`);
                  JsonHelper.isStringObj(temp) &&
                    objList.push(JsonHelper.stringObjToJson(temp));
                }
              }
              if (objList.length === value.length) {
                matchedValue = objList;
              }
            }
            break;
        }
      } catch {}
      if (matchedValue !== null) continue;
    }
    if (matchedValue !== null) {
      matchedDatas[key] = matchedValue;
    } else {
      notification.error({
        message: "类型错误",
        description: `部分参数类型错误，请检查各节点字段是否符合Pipeline协议；可能的参数：${key}`,
        placement: "top",
      });
    }
  });
  return matchedDatas;
}
// 创建节点
function parsePipelineNode(fNode: PipelineNodeType): ParsedPipelineNodeType {
  const fNodeData = fNode.data;
  // 识别
  const recoType = fNodeData.recognition.type;
  const recognition = {
    type: recoType,
    param: matchParamType(
      fNodeData.recognition.param,
      recoFields[recoType].params
    ),
  };
  // 动作
  const actionType = fNodeData.action.type;
  const action = {
    type: actionType,
    param: matchParamType(
      fNodeData.action.param,
      actionFields[actionType].params
    ),
  };
  // 其他节点
  const others = matchParamType(fNodeData.others, otherFieldParams);
  const extras = JsonHelper.isObj(fNodeData.extras)
    ? fNodeData.extras
    : JsonHelper.stringObjToJson(
        String(fNodeData.extras).replaceAll(/[“”]/g, `"`)
      ) ?? {};
  // 赋值
  const pNode: ParsedPipelineNodeType = {
    recognition,
    action,
    ...others,
    ...extras,
  };
  if (useConfigStore.getState().configs.isExportConfig) {
    const position = fNode.position;
    pNode[configMark] = {
      position: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
    };
  }
  return pNode;
}
// 保存外部节点位置
function parseExternalNode(fNode: PipelineNodeType): ParsedPipelineNodeType {
  const position = fNode.position;
  const pNode: ParsedPipelineNodeType = {
    [configMark]: {
      position: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
    },
  };
  return pNode;
}

// 转录
export function flowToPipeline(datas?: {
  nodes?: NodeType[];
  edges?: EdgeType[];
  fileName?: string;
  config?: FileConfigType;
}): PipelineObjType {
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
          pipelineObj[prefix + node.data.label] = parsePipelineNode(
            node as PipelineNodeType
          );
          break;
        case NodeTypeEnum.External:
          if (!generalConfig.isExportConfig) break;
          pipelineObj[externalMarkPrefix + node.data.label + "_" + fileName] =
            parseExternalNode(node as PipelineNodeType);
          break;
      }
    });

    // 链接
    edges.forEach((edge) => {
      // 获取节点数据
      const sourceKey = findNodeLabelById(edge.source);
      const pSourceNode = pipelineObj[prefix + sourceKey];
      if (!pSourceNode) return;
      const targetKey = findNodeLabelById(edge.target);
      const pTargetNode = pipelineObj[prefix + targetKey];
      // 添加链接
      const toPNodeKey = pTargetNode ? prefix + targetKey : targetKey;
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
          version: globalConfig.version,
        },
      },
      ...pipelineObj,
    };
  } catch (err) {
    notification.error({
      message: "导出失败！",
      description: "请检查个节点字段是否符合格式，详细程序错误请在控制台查看",
      placement: "top",
    });
    console.error(err);
    return {};
  }
}

/**导入 */
type IdLabelPairsType = {
  id: string;
  label: string;
}[];

// 判断配置字段
function isConfigKey(key: string): boolean {
  return (
    key.startsWith(configMarkPrefix) ||
    key.startsWith("__mpe_config_") ||
    key.startsWith("__yamaape_config_")
  );
}
function isMark(key: string): boolean {
  return key === configMark || key === "__mpe_code" || key === "__yamaape";
}
function getConfigMark(configObj: any): any {
  if (configObj[configMark]) {
    return configObj[configMark];
  } else if (configObj["__mpe_code"]) {
    return configObj["__mpe_code"];
  } else if (configObj["__yamaape"]) {
    return configObj["__yamaape"];
  }
  return null;
}

// 合成链接
let idCounter = 1;
function linkEdge(
  oSourceLabel: string,
  oTargetLabels: string[],
  type: SourceHandleTypeEnum,
  idOLPairs: IdLabelPairsType
): [EdgeType[], NodeType[], IdLabelPairsType] {
  // 检索节点名
  const sourceId = idOLPairs.find((pair) => pair.label === oSourceLabel)
    ?.id as string;
  // 检查
  const edges: EdgeType[] = [];
  const nodes: NodeType[] = [];
  const newIdOLPairs: IdLabelPairsType = [];
  if (!Array.isArray(oTargetLabels)) oTargetLabels = [oTargetLabels];
  oTargetLabels.forEach((targetLabel, index) => {
    let targetId = idOLPairs.find((pair) => pair.label === targetLabel)?.id;
    // 创建外部节点
    const externalId = "e_" + idCounter++;
    if (!targetId) {
      const node = createExternalNode(externalId, { label: targetLabel });
      targetId = node.id;
      nodes.push(node);
      newIdOLPairs.push({
        id: targetId,
        label: targetLabel,
      });
    }
    // 连接
    edges.push({
      id: `${sourceId}_${type}_${targetId}`,
      source: sourceId,
      sourceHandle: type,
      target: targetId ?? externalId,
      targetHandle: "target",
      label: index + 1,
      type: "marked",
    });
  });
  return [edges, nodes, newIdOLPairs];
}

// 转换
type PipelineConfigType = {
  filename?: string;
  version?: string;
  prefix?: string;
  [key: string]: any;
};
// 检测单个节点的版本
function detectNodeVersion(node: any): number {
  if (!node || typeof node !== "object") return 2;

  // 检查 recognition 字段
  if (node.recognition !== undefined) {
    // v2: recognition 是对象，包含 type 和 param
    if (
      typeof node.recognition === "object" &&
      node.recognition !== null &&
      "type" in node.recognition
    ) {
      return 2;
    }
    // v1: recognition 是字符串
    if (typeof node.recognition === "string") {
      return 1;
    }
  }

  // 检查 action 字段
  if (node.action !== undefined) {
    // v2: action 是对象，包含 type 和 param
    if (
      typeof node.action === "object" &&
      node.action !== null &&
      "type" in node.action
    ) {
      return 2;
    }
    // v1: action 是字符串
    if (typeof node.action === "string") {
      return 1;
    }
  }

  // 检查是否有 v1 特征：识别和动作参数字段直接在节点根层级
  const nodeKeys = Object.keys(node);
  const hasRecoParams = nodeKeys.some((k) =>
    recoFieldSchemaKeyList.includes(k)
  );
  const hasActionParams = nodeKeys.some((k) =>
    actionFieldSchemaKeyList.includes(k)
  );
  if (hasRecoParams || hasActionParams) {
    // 但如果同时有 recognition.param 或 action.param，则是 v2
    const hasV2Structure =
      node.recognition?.param !== undefined || node.action?.param !== undefined;
    if (!hasV2Structure) {
      return 1;
    }
  }

  // 默认返回 v2
  return 2;
}

export async function pipelineToFlow(options?: { pString?: string }) {
  try {
    // 获取参数
    const pString = options?.pString ?? (await ClipboardHelper.read());
    const pipelineObj = parseJsonc(pString);
    // 解析配置
    const objKeys = Object.keys(pipelineObj);
    const configs: PipelineConfigType = {};
    const configKey = objKeys.find((objKey) => isConfigKey(objKey));
    if (configKey) {
      let configObj = pipelineObj[configKey];
      // 兼容新旧版本的配置标记
      const markedConfig = getConfigMark(configObj);
      if (markedConfig) {
        configObj = markedConfig;
      }
      Object.assign(configs, configObj);
    }
    // 解析节点
    let nodes: NodeType[] = [];
    const originLabels: string[] = []; // 去掉前缀后的节点名
    const originalKeys: string[] = []; // 原始完整节点名（包含前缀）
    let idOLPairs: IdLabelPairsType = [];
    let isIncludePos = false;
    objKeys.forEach((objKey) => {
      const obj = pipelineObj[objKey];
      // 跳过配置
      if (isConfigKey(objKey)) return;

      // 检测当前节点的版本
      const nodeVersion = detectNodeVersion(obj);
      // 处理节点名
      const id = "p_" + idCounter++;
      let label = objKey;
      // 删除前后缀
      let type = NodeTypeEnum.Pipeline;
      if (objKey.startsWith(externalMarkPrefix)) {
        type = NodeTypeEnum.External;
        label = label.substring(externalMarkPrefix.length);
        const filename = configs.filename;
        if (filename)
          label = label.substring(0, label.length - filename.length - 1);
        originLabels.push(label);
        originalKeys.push(objKey);
        idOLPairs.push({ id, label });
      } else {
        originLabels.push(label);
        originalKeys.push(objKey);
        idOLPairs.push({ id, label });
        const prefix = configs.prefix;
        if (prefix) label = label.substring(prefix.length + 1);
      }
      // 解析数据
      const node =
        type === NodeTypeEnum.Pipeline
          ? createPipelineNode(id, { label })
          : (createExternalNode(id, { label }) as PipelineNodeType);
      const keys = Object.keys(obj);
      keys.forEach((key) => {
        // 跳过链接
        if (key === "next" || key === "interrupt" || key === "on_error") return;
        // 标记字段
        let value = obj[key];
        if (isMark(key)) {
          Object.assign(node, value);
          isIncludePos = true;
        }
        // 识别算法
        else if (key === "recognition") {
          switch (nodeVersion) {
            case 1:
              if (!Object.values(upperRecoValues).includes(value)) {
                let idx = Object.keys(upperRecoValues).findIndex(
                  (k) => k === value.toUpperCase()
                );
                if (idx >= 0) value = Object.values(upperRecoValues)[idx];
                else throw new Error("识别算法类型错误");
              }
              node.data.recognition.type = value;
              break;
            case 2:
              if (!Object.values(upperRecoValues).includes(value.type)) {
                let idx = Object.keys(upperRecoValues).findIndex(
                  (k) => k === value.type.toUpperCase()
                );
                if (idx >= 0) value.type = Object.values(upperRecoValues)[idx];
                else throw new Error("识别算法类型错误");
              }
              node.data.recognition = value;
              break;
          }
        } else if (recoFieldSchemaKeyList.includes(key) && nodeVersion === 1)
          node.data.recognition.param[key] = value;
        // 动作类型
        else if (key === "action") {
          switch (nodeVersion) {
            case 1:
              if (!Object.values(upperActionValues).includes(value)) {
                let idx = Object.keys(upperActionValues).findIndex(
                  (k) => k === value.toUpperCase()
                );
                if (idx >= 0) value = Object.values(upperActionValues)[idx];
                else throw new Error("动作类型错误");
              }
              node.data.action.type = value;
              break;
            case 2:
              if (!Object.values(upperActionValues).includes(value.type)) {
                let idx = Object.keys(upperActionValues).findIndex(
                  (k) => k === value.type.toUpperCase()
                );
                if (idx >= 0)
                  value.type = Object.values(upperActionValues)[idx];
                else throw new Error("动作类型错误");
              }
              node.data.action = value;
              break;
          }
        } else if (actionFieldSchemaKeyList.includes(key) && nodeVersion === 1)
          node.data.action.param[key] = value;
        // 其他字段
        else if (otherFieldSchemaKeyList.includes(key))
          node.data.others[key] = value;
        // 额外字段
        else node.data.extras[key] = value;
      });
      // 检查节点
      if (type === NodeTypeEnum.Pipeline) {
        node.data.recognition.param ??= {};
        node.data.action.param ??= {};
      }
      // 保存数据
      nodes.push(node);
    });

    // 解析连接
    let edges: EdgeType[] = [];
    for (let index = 0; index < originLabels.length; index++) {
      const objKey = originalKeys[index]; // 使用原始完整节点名
      const obj = pipelineObj[objKey];
      if (!obj) continue;
      const originLabel = originLabels[index];
      // next
      const next = obj["next"] as string[];
      if (next) {
        const [newEdges, newNodes, newIdOLPairs] = linkEdge(
          originLabel,
          next,
          SourceHandleTypeEnum.Next,
          idOLPairs
        );
        newEdges.length > 0 && (edges = edges.concat(newEdges));
        newNodes.length > 0 && (nodes = nodes.concat(newNodes));
        newIdOLPairs.length > 0 && (idOLPairs = idOLPairs.concat(newIdOLPairs));
      }
      // interrupt
      const interrupt = obj["interrupt"] as string[];
      if (interrupt) {
        const [newEdges, newNodes, newIdOLPairs] = linkEdge(
          originLabel,
          interrupt,
          SourceHandleTypeEnum.Interrupt,
          idOLPairs
        );
        newEdges.length > 0 && (edges = edges.concat(newEdges));
        newNodes.length > 0 && (nodes = nodes.concat(newNodes));
        newIdOLPairs.length > 0 && (idOLPairs = idOLPairs.concat(newIdOLPairs));
      }
      // on_error
      const onError = obj["on_error"] as string[];
      if (onError) {
        const [newEdges, newNodes, newIdOLPairs] = linkEdge(
          originLabel,
          onError,
          SourceHandleTypeEnum.Error,
          idOLPairs
        );
        newEdges.length > 0 && (edges = edges.concat(newEdges));
        newNodes.length > 0 && (nodes = nodes.concat(newNodes));
        newIdOLPairs.length > 0 && (idOLPairs = idOLPairs.concat(newIdOLPairs));
      }
    }

    // 更新flow
    useFlowStore.getState().replace(nodes, edges, { isFitView: isIncludePos });
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
