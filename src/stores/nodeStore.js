import { defineStore } from "pinia";

import { TopNotice } from "../utils/notice";
import Page from "../utils/page";

let nodeCounter = 0;

export const useNodeStore = defineStore("NodeStore", {
  state: () => ({
    nodes: [
      {
        id: "0",
        type: "input",
        data: { label: "开始任务" },
        position: { x: 0, y: 0 },
        sourcePosition: "right",
      },
    ],
    edges: [],
    currentNodeId: null,
  }),
  getters: {
    currentNode: (state) => {
      return state.nodes.find((node) => node.id == state.currentNodeId);
    },
    nodeCount: (state) => {
      return state.nodes.length;
    },
    edgeCount: (state) => {
      return state.edges.length;
    },
    addPosition: (state) => {
      // 找到所有节点的最右侧
      let maxX = -Infinity;
      state.nodes.forEach((node) => {
        if (node.position.x > maxX) {
          maxX = node.position.x;
        }
      });
      // 计算所有节点的平均y值
      let avgY = 0;
      state.nodes.forEach((node) => {
        avgY += node.position.y;
      });
      avgY /= state.nodeCount;
      return { x: maxX + 260, y: Math.round(avgY) };
    },
  },
  actions: {
    clear() {
      this.nodes = [
        {
          id: "0",
          type: "input",
          data: { label: "开始任务" },
          position: { x: 0, y: 0 },
          sourcePosition: "right",
        },
      ];
      this.edges = [];
      this.currentNodeId = null;
    },
    /**节点操作 */
    // 获取节点
    findNodeIndex(id) {
      return this.nodes.findIndex((node) => node.id == id);
    },
    findNode(id) {
      return this.nodes.find((node) => node.id == id);
    },
    findNodeByLabel(label) {
      return this.nodes.find((node) => node.data.label == label);
    },

    // 添加节点
    addNode(
      recognition = "DirectHit",
      action = "DoNothing",
      { viewer, autoSelect } = { viewer: null, autoSelect: false }
    ) {
      // 检查节点是否存在
      if (this.findNodeIndex(nodeCounter) != -1) {
        nodeCounter++;
        return this.addNode();
      }
      const id = nodeCounter.toString();
      const position = { ...this.addPosition };
      const node = {
        id,
        type: "template",
        data: {
          label: "新增节点" + nodeCounter++,
          recognition,
          action,
        },
        position,
      };
      this.nodes.push(node);
      if (autoSelect) {
        this.currentNodeId = id;
      }
      if (viewer) {
        Page.focus(viewer, { position });
      }
      return node;
    },

    // 更新节点
    updateNode(id, data) {
      const node = this.findNode(id);
      Object.assign(node, data);
    },

    // 删除节点
    removeNode(node) {
      const { id } = node;
      if (id == "0") {
        TopNotice.error("开始节点不能删除，将在下次更新时还原");
        return;
      }
      const nodeIndex = this.findNodeIndex(id);
      if (nodeIndex != -1) {
        this.nodes.splice(nodeIndex, 1);
      }
    },

    /**边操作 */
    // 获取边
    findEdgeIndex(source, target, sourceHandle) {
      return this.edges.findIndex((edge) => {
        return (
          edge.source == source &&
          edge.target == target &&
          edge.sourceHandle == sourceHandle
        );
      });
    },
    findEdge(source, target, sourceHandle) {
      return this.edges.find((edge) => {
        return (
          edge.source == source &&
          edge.target == target &&
          edge.sourceHandle == sourceHandle
        );
      });
    },

    // 添加边
    addEdge(connection) {
      const { source, target, sourceHandle, targetHandle } = connection;
      // 检查是否已存在边
      if (this.findEdge(source, target, sourceHandle)) return;
      // 添加边
      this.edges.push({
        id: `${source}-${sourceHandle || "next"}-${target}`,
        source,
        target,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        class: (sourceHandle || "target") + "-edge",
      });
    },

    // 删除边
    removeEdge(edge) {
      const { source, target, sourceHandle } = edge;
      const edgeIndex = this.findEdgeIndex(source, target, sourceHandle);
      if (edgeIndex != -1) {
        this.edges.splice(edgeIndex, 1);
      }
    },
  },
});
