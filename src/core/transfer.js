import { toRaw } from "vue";

import { TopNotice } from "../utils/notice";
import { recognitionFields } from "../fields/recognitions";
import { actionFields } from "../fields/actions";
import { extraFields } from "../fields/extras";
import { useNodeStore } from "../stores/nodeStore";

function parseNodeKey(filename, label, id) {
  return `${filename}_${label}`;
}

function parseFields(nodeData) {
  const keys = Object.keys(nodeData);
  const fields = {};

  // 识别算法
  fields["recognition"] = nodeData.recognition;
  const recognitionExtraKeys = Object.keys(
    recognitionFields[nodeData.recognition]?.extras || {}
  );
  // 执行方式
  fields["action"] = nodeData.action;
  const actionExtraKeys = Object.keys(
    actionFields[nodeData.action]?.extras || {}
  );
  // 其他
  const extraKeys = Object.keys(extraFields);
  const validKeys = [...recognitionExtraKeys, ...actionExtraKeys, ...extraKeys];

  keys.forEach((key) => {
    if (!validKeys.includes(key)) return;
    fields[key] = toRaw(nodeData[key]);
  });

  return fields;
}

function addEdgeFromLabels(sourceNode, edgeIds, type) {
  if (typeof edgeIds != "object") return;
  const nodeStore = useNodeStore();
  edgeIds.forEach((label) => {
    const targetLabel = label.split("_")[1];
    const targetNode = nodeStore.findNodeByLabel(targetLabel);
    const edge = {
      source: sourceNode?.id || "0",
      target: targetNode.id,
      sourceHandle:
        sourceNode?.data?.label == undefined ||
        sourceNode.data.label == "开始任务"
          ? null
          : type,
      targetHandle: "target",
    };
    nodeStore.addEdge(edge);
  });
}

export default class Transfer {
  static getValidFields(nodeData) {
    return parseFields(nodeData);
  }

  // 节点转Json
  static nodeToJsonObj(filename) {
    const nodeStore = useNodeStore();
    const edges = nodeStore.edges;
    const jsonObj = {};

    // 连接节点
    edges.forEach((edge) => {
      const source = edge.source;
      const target = edge.target;
      const type = edge.sourceHandle;

      // 生成节点名
      const sourceNode = nodeStore.findNode(source);
      const sourceNodeData = sourceNode?.data;
      const targetNode = nodeStore.findNode(target);
      const targetNodeData = targetNode.data;
      const sourceKey =
        sourceNodeData.label == "开始任务"
          ? filename
          : parseNodeKey(filename, sourceNodeData.label);
      const targetKey = parseNodeKey(filename, targetNodeData.label);

      // 创建节点
      if (!jsonObj[sourceKey]) {
        jsonObj[sourceKey] = parseFields(sourceNodeData);
        jsonObj[sourceKey].__yamaape = {
          position: sourceNode.position,
        };
      }
      if (!jsonObj[targetKey]) {
        jsonObj[targetKey] = parseFields(targetNodeData);
        jsonObj[targetKey].__yamaape = {
          position: targetNode.position,
        };
      }

      // 连接节点
      if (!jsonObj[sourceKey][type || "next"]) {
        jsonObj[sourceKey][type || "next"] = [];
      }
      jsonObj[sourceKey][type || "next"].push(targetKey);
    });

    if (jsonObj[filename]) {
      delete jsonObj[filename].recognition;
      delete jsonObj[filename].action;
    }
    return jsonObj;
  }

  // Json转节点
  static jsonToNodes(json, isTip = true) {
    const nodeStore = useNodeStore();
    const backupNodes = toRaw(nodeStore.nodes);
    const backupEdges = toRaw(nodeStore.edges);
    let filename = true;
    try {
      // 格式转化
      if (typeof json != "object") {
        json = JSON.parse(json);
      }
      nodeStore.clear();
      // 提取节点
      Object.keys(json).forEach((key) => {
        const obj = json[key];
        const label = key.split("_")[1];
        if (label == "开始任务" || label == undefined) {
          if (obj.__yamaape) {
            Object.keys(obj.__yamaape).forEach((key) => {
              nodeStore.nodes[0][key] = obj.__yamaape[key];
            });
          }
          filename = key.split("_")[0];
          return;
        }
        // 添加节点
        const node = nodeStore.addNode();
        if (obj.__yamaape) {
          Object.keys(obj.__yamaape).forEach((key) => {
            node[key] = obj.__yamaape[key];
          });
        }
        node.data.label = label;
        Object.assign(node.data, parseFields(obj));
      });
      // 添加连接
      Object.keys(json).forEach((key) => {
        const obj = json[key];
        const label = key.split("_")[1];
        const node = nodeStore.findNodeByLabel(label);
        addEdgeFromLabels(node, obj.next, "next");
        addEdgeFromLabels(node, obj.interrupt, "interrupt");
        addEdgeFromLabels(node, obj.on_error, "on_error");
      });
      if (isTip) {
        TopNotice.success("Json转换成功");
      }
      return filename;
    } catch (e) {
      nodeStore.nodes = backupNodes;
      nodeStore.edges = backupEdges;
      TopNotice.error("JSON格式错误");
      console.log(e);
      return false;
    }
  }
}

/*
const testJsonStr = `
{"新建文件1_开始任务":{"next":["新建文件1_新增节点1","新建文件1_新增节点2"]},"新建文件1_新增节点1":{"recognition":"OCR","action":"Click","index":0,"target":[0,0,0,0],"timeout":20000,"next":["新建文件1_新增节点3"]},"新建文件1_新增节点2":{"recognition":"DirectHit","action":"DoNothing","interrupt":["新建文件1_新增节点3"],"on_error":["新建文件1_新增节点3"]},"新建文件1_新增节点3":{"recognition":"DirectHit","action":"DoNothing"}}
`;
*/
