<style>
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";
</style>

<style lang="scss" scoped>
#WorkSpace {
  width: 100%;
  height: 100%;
}
</style>

<template>
  <div :id="appName">
    <ToolBar :viewer="viewer" @align="alignSelectedNodes" />
    <AttrPanel />
    <VueFlow
      :nodes="nodeStore.nodes"
      :edges="nodeStore.edges"
      :max-zoom="2"
      :min-zoom="0.2"
    >
      <!-- 插件 -->
      <Background />
      <Controls />
      <!-- 节点 -->
      <template #node-template="props">
        <TemplateNode :id="props.id" :data="props.data" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("WorkSpace");
// 控件
const viewer = ref(false);
// 状态
// 数据
const nodeUpdateTimeouts = ref({});

/**属性 */
/**函数 */
// 更新节点位置
function updateNodePosition(node) {
  if (!node.position) return;
  if (nodeUpdateTimeouts[node.id]) {
    clearInterval(nodeUpdateTimeouts[node.id]);
  }
  nodeUpdateTimeouts[node.id] = setTimeout(() => {
    nodeStore.updateNode(node.id, {
      position: {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      },
    });
  }, 200);
}

function alignSelectedNodes(direction) {
  const selectedNodes = getSelectedNodes.value;
  if (selectedNodes.length < 2) return;
  if (selectedNodes.length < 3 && direction.includes("distribute")) return;

  let reference;
  switch (direction) {
    case "left":
      reference = Math.min(...selectedNodes.map((n) => n.position.x));
      selectedNodes.forEach((n) => (n.position.x = reference));
      break;
    case "right":
      reference = Math.max(
        ...selectedNodes.map((n) => n.position.x + (n.width || 0))
      );
      selectedNodes.forEach((n) => (n.position.x = reference - (n.width || 0)));
      break;
    case "top":
      reference = Math.min(...selectedNodes.map((n) => n.position.y));
      selectedNodes.forEach((n) => (n.position.y = reference));
      break;
    case "bottom":
      reference = Math.max(
        ...selectedNodes.map((n) => n.position.y + (n.height || 0))
      );
      selectedNodes.forEach((n) => (n.position.y = reference - (n.height || 0)));
      break;
    case "horizontal-distribute": {
      const nodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
      const left = nodes[0].position.x;
      const right = nodes[nodes.length - 1].position.x;
      const totalWidth = nodes.reduce((sum, n) => sum + (n.width || 0), 0);
      const spacing = (right - left - totalWidth) / (nodes.length - 1);

      let currentX = left;
      for (const node of nodes) {
        node.position.x = currentX;
        currentX += (node.width || 0) + spacing;
      }
      break;
    }
    case "vertical-distribute": {
      const nodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
      const top = nodes[0].position.y;
      const bottom = nodes[nodes.length - 1].position.y;
      const totalHeight = nodes.reduce((sum, n) => sum + (n.height || 0), 0);
      const spacing = (bottom - top - totalHeight) / (nodes.length - 1);

      let currentY = top;
      for (const node of nodes) {
        node.position.y = currentY;
        currentY += (node.height || 0) + spacing;
      }
      break;
    }
  }
}

/**监听 */
// 挂载
onMounted(async () => {
  nextTick(() => {
    onInit((i) => {
      viewer.value = i;
    });
  });
  // 选中节点
  onNodeClick(({ node }) => {
    nodeStore.currentNodeId = null;
    nextTick(() => {
      nodeStore.currentNodeId = node.id;
    });
  });
  // 更新节点
  onNodesChange((nodes) => {
    nodes.forEach((node) => {
      const { type } = node;
      switch (type) {
        case "remove":
          nodeStore.removeNode(node);
          break;
        case "position":
          updateNodePosition(node);
          break;
      }
    });
  });
  // 取消选中
  onPaneClick(() => {
    nodeStore.currentNodeId = null;
  });

  // 连接节点
  onConnect((connection) => {
    nodeStore.addEdge(connection);
  });
  // 更新连接
  onEdgesChange((edges) => {
    edges.forEach((edge) => {
      const { type } = edge;
      switch (type) {
        case "remove":
          nodeStore.removeEdge(edge);
          break;
      }
    });
  });
  // 按键映射
  document.addEventListener("keydown", function (event) {
    if (event.key === "Delete") {
      event.preventDefault();
      const backspaceEvent = new KeyboardEvent("keydown", {
        key: "Backspace",
        code: "Backspace",
        keyCode: 8,
        which: 8,
        bubbles: true,
        cancelable: true,
      });
      event.target.dispatchEvent(backspaceEvent);
    }
  });
});

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted, nextTick } from "vue";
// flow
import { VueFlow, useVueFlow } from "@vue-flow/core";
const {
  onPaneClick,
  onNodeClick,
  onNodesChange,
  onConnect,
  onEdgesChange,  
  getSelectedNodes, 
  getNodes,
  onInit,
} = useVueFlow();
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import "@vue-flow/controls/dist/style.css";
// pinia
import { useNodeStore } from "../stores/nodeStore";
const nodeStore = useNodeStore();

/**组件 */
import ToolBar from "./ToolBar.vue";
import AttrPanel from "../components/AttrPanel.vue";
import TemplateNode from "../components/node/TemplateNode.vue";

/** */
</script>
