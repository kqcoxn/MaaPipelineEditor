import { type Connection } from "@xyflow/react";

import {
  useFlowStore,
  findNodeLabelById,
  type NodeType,
  type PipelineNodeType,
  type RecognitionParamType,
  type ActionParamType,
  type OtherParamType,
  type ParamType,
} from "../stores/flowStore";
import {
  FieldTypeEnum,
  recoFields,
  actionFields,
  otherFieldParams,
  type FieldType,
} from "./fields";
import { NodeTypeEnum, SourceHandleTypeEnum } from "../components/flow/nodes";
import { JsonHelper } from "../utils/jsonHelper";

const uniqueMark = "__mpe";
type ParsedPipelineNodeType = {
  [uniqueMark]: {
    position: { x: number; y: number };
  };
  recognition: {
    type: "TemplateMatch";
    param: RecognitionParamType;
  };
  action: {
    type: "TemplateMatch";
    param: ActionParamType;
  };
  [SourceHandleTypeEnum.Next]: string[];
  [SourceHandleTypeEnum.Interrupt]: string[];
  [SourceHandleTypeEnum.Error]: string[];
} & OtherParamType &
  any;
type PipelineObjType = Record<string, ParsedPipelineNodeType>;

/**转录为 PipelineObj */
// 数据匹配
function puraStringList(list: any): string[] {
  return String(list)
    .replace(/[\s\[\]]/g, "")
    .split(",");
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
                matchedValue = number2DList;
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
          // 键值对
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
            temp = String(value).replaceAll(/[“”]/g, `"`);
            try {
              matchedValue = JSON.parse(temp);
            } catch {
              matchedValue = temp;
            }
            break;
          // ObjectList
          case FieldTypeEnum.ObjectList:
            if (Array.isArray(value)) {
              const objList = [];
              for (let obj of value) {
                try {
                  objList.push(JSON.parse(obj));
                } catch {
                  break;
                }
              }
              if (objList.length === value.length) {
                matchedValue = objList;
              }
            }
            break;
        }
      } catch {}
    }
    if (matchedValue !== null) {
      matchedDatas[key] = matchedValue;
    } else {
      console.log("类型错误");
      // 类型错误
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
  // 行为
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
  const extras =
    JsonHelper.stringObjToJson(
      String(fNodeData.extras).replaceAll(/[“”]/g, `"`)
    ) ?? {};
  // 赋值
  const pNode: ParsedPipelineNodeType = {
    recognition,
    action,
    ...others,
    ...extras,
  };
  pNode[uniqueMark] = {
    position: fNode.position,
  };
  return pNode;
}
// 链接
function addLink(
  fromPNode: ParsedPipelineNodeType,
  toPNodeKey: string,
  linkType: SourceHandleTypeEnum
) {
  if (!(linkType in fromPNode)) fromPNode[linkType] = [];
  fromPNode[linkType].push(toPNodeKey);
}

// 转录
export function flowToPipeline(): PipelineObjType {
  // 获取当前 flow 数据
  const state = useFlowStore.getState();
  const nodes = state.nodes as NodeType[];
  const edges = state.edges as Connection[];

  // 生成节点
  const pipelineObj: PipelineObjType = {};
  nodes.forEach((node) => {
    if (node.type === NodeTypeEnum.External) return;
    pipelineObj[node.data.label] = parsePipelineNode(node as PipelineNodeType);
  });

  // 链接
  edges.forEach((edge) => {
    const sourceKey = findNodeLabelById(edge.source);
    const targetKey = findNodeLabelById(edge.target);
    addLink(
      pipelineObj[sourceKey],
      targetKey,
      edge.sourceHandle as SourceHandleTypeEnum
    );
  });

  return pipelineObj;
}
