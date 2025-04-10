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
    <ToolBar :viewer="viewer" />
    <AttrPanel />
    <VueFlow :nodes="nodeStore.nodes" :edges="nodeStore.edges">
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

/**属性 */
/**函数 */

/**监听 */
// 挂载
onMounted(async () => {
  nextTick(() => {
    onInit((i) => {
      viewer.value = i;
    });
  });
  // 更新位置
  onNodeDragStop(({ node }) => {
    const {
      id,
      position: { x, y },
    } = node;
    nodeStore.updateNode(id, {
      position: { x: Math.round(x), y: Math.round(y) },
    });
  });
  // 选中节点
  onNodeClick(({ node }) => {
    nodeStore.currentNodeId = node.id;
  });
  // 更新节点
  onNodesChange((nodes) => {
    nodes.forEach((node) => {
      const { type } = node;
      switch (type) {
        case "remove":
          nodeStore.removeNode(node);
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
  onNodeDragStop,
  onNodeClick,
  onNodesChange,
  onConnect,
  onEdgesChange,
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
