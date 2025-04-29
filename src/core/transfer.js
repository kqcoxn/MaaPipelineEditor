import { toRaw } from "vue";

import { TopNotice } from "../utils/notice";
import { recognitionFields } from "../fields/recognitions";
import { actionFields } from "../fields/actions";
import { extraFields } from "../fields/extras";
import { useNodeStore } from "../stores/nodeStore";
import { useFileStore } from "../stores/fileStore";
import settings from "../settings";

function createNodeKey(label, prefix = "") {
  if (prefix) {
    return `${prefix}_${label}`;
  }
  return label;
}
function parseNodeKey(key, prefix = "") {
  if (prefix) {
    return key.split("_").at(-1);
  }
  return key;
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

// 添加边
function addEdgeFromLabels(sourceNode, edgeIds, type) {
  if (typeof edgeIds != "object") return;
  const nodeStore = useNodeStore();
  const fileStore = useFileStore();
  edgeIds.forEach((label) => {
    const targetLabel = parseNodeKey(label, fileStore.currentConfig?.prefix);
    const targetNode = nodeStore.findNodeByLabel(targetLabel);
    const edge = {
      source: sourceNode?.id || "0",
      target: targetNode.id,
      sourceHandle: type,
      targetHandle: "target",
    };
    nodeStore.addEdge(edge);
  });
}

// 节点转Json
function createSingleNodeObj(node, data) {
  const nodeObj = parseFields(data);
  if (nodeObj.jump_yamaape) {
    nodeObj.next = [nodeObj.jump_yamaape];
  }
  nodeObj.__yamaape = {
    position: node.position,
  };
  return nodeObj;
}

export default class Transfer {
  static getValidFields(nodeData) {
    return parseFields(nodeData);
  }

  // 节点转Json
  static nodeToJsonObj(filename) {
    const nodeStore = useNodeStore();
    const fileStore = useFileStore();
    const nodes = nodeStore.nodes;
    const edges = nodeStore.edges;
    const config = fileStore.currentConfig;
    const jsonObj = {};
    jsonObj["__yamaape_config_" + filename] = {
      filename: filename,
      version: settings.version,
      ...config,
    };

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
      const sourceKey = createNodeKey(sourceNodeData.label, config?.prefix);
      const targetKey = createNodeKey(targetNodeData.label, config?.prefix);

      // 创建节点
      if (!jsonObj[sourceKey]) {
        jsonObj[sourceKey] = createSingleNodeObj(sourceNode, sourceNodeData);
      }
      if (!jsonObj[targetKey]) {
        jsonObj[targetKey] = createSingleNodeObj(targetNode, targetNodeData);
      }

      // 连接节点
      if (!jsonObj[sourceKey][type || "next"]) {
        jsonObj[sourceKey][type || "next"] = [];
      }
      jsonObj[sourceKey][type || "next"].push(targetKey);
    });

    // 补全孤节点
    const jsonKeys = Object.keys(jsonObj);
    for (const node of nodes) {
      const key = createNodeKey(node.data.label, config?.prefix);
      if (!jsonKeys.includes(key)) {
        jsonObj[key] = createSingleNodeObj(node, node.data);
      }
    }

    // 处理统一错误出口
    if (config?.export) {
      Object.keys(jsonObj).forEach((key) => {
        if (key.includes("__yamaape_config")) return;
        if (!jsonObj[key]["on_error"]) {
          jsonObj[key].on_error = [];
        }
        jsonObj[key].on_error.push(config.export);
      });
    }

    return jsonObj;
  }

  // Json转节点
  static jsonToNodes(json, isTip = true) {
    const nodeStore = useNodeStore();
    const fileStore = useFileStore();
    const backupNodes = toRaw(nodeStore.nodes);
    const backupEdges = toRaw(nodeStore.edges);
    const config = fileStore.currentConfig;
    let filename = false;
    try {
      // 格式转化
      if (typeof json != "object") {
        json = JSON.parse(json);
      }
      nodeStore.clear();
      // 提取节点
      const keys = Object.keys(json);
      // 特殊节点
      for (const key of keys) {
        // 设置节点
        if (key.includes("__yamaape_config")) {
          delete json[key].version;
          fileStore.currentFile.config = json[key];
          const config = fileStore.currentConfig;
          if (config.filename) {
            filename = config.filename;
          }
        }
      }
      const config = fileStore.currentConfig;
      // 普通节点
      keys.forEach((key) => {
        const obj = json[key];
        // 跳过特殊节点
        if (key.includes("__yamaape_config")) {
          return;
        }
        // 解析节点数据
        const label = parseNodeKey(key, config?.prefix);
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
      keys.forEach((key) => {
        const obj = json[key];
        // 解析节点数据
        const label = parseNodeKey(key, config?.prefix);
        // 跳过特殊节点
        if (key.includes("__yamaape_config")) {
          return;
        }
        // 获取节点
        const node = nodeStore.findNodeByLabel(label);
        // 删除跳跃节点
        if (obj.jump_yamaape && obj.next) {
          obj.next = obj.next.filter((item) => item != obj.jump_yamaape);
        }
        // 添加边
        addEdgeFromLabels(node, obj.next, "next");
        addEdgeFromLabels(node, obj.interrupt, "interrupt");
        if (obj.on_error?.includes(config.export)) {
          obj.on_error = obj.on_error.filter((item) => item != config.export);
        }
        addEdgeFromLabels(node, obj.on_error, "on_error");
      });

      for (const key of keys) {
        if (key.includes("__yamaape_config")) {
          config.export = "";
          break;
        }
      }

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
