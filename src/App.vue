<style lang="scss" scoped>
#App {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .main {
    display: flex;
    position: relative;

    .workspace {
      flex: 1;
    }
  }
}
</style>

<template>
  <div :id="appName">
    <Header class="header" />
    <FileManager />
    <div class="main fill">
      <WorkSpace class="worlspace" />
      <JsonViewer />
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("App");
// 控件
const viewer = ref(null);
// 状态
// 数据

/**属性 */
/**函数 */

/**监听 */
// 挂载
onMounted(async () => {
  onInit((i) => {
    viewer.value = i;
    Page.focus(viewer.value);
  });
  nextTick(() => {
    fileStore.clear();
    let exist = Storage.load((filename, jsonObj) => {
      fileStore.addFile(filename, false);
      Transfer.jsonToNodes(jsonObj, false);
      setTimeout(() => {
        if (viewer.value) {
          Page.focus(viewer.value, { viewport: true, padding: 0.2 });
        }
      }, 100);
    });
    if (!exist) {
      fileStore.addFile(null, false);
      setTimeout(() => {
        if (viewer.value) {
          Page.focus(viewer.value, { viewport: true, padding: 0.2 });
        }
      }, 100);
    }
  });
});

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted, nextTick } from "vue";
// flow
import { useVueFlow } from "@vue-flow/core";
const { onInit } = useVueFlow();
// pinia
import { useFileStore } from "./stores/fileStore";
const fileStore = useFileStore();
import { useNodeStore } from "./stores/nodeStore";
const nodeStore = useNodeStore();
// core
import Transfer from "./core/transfer";
// utils
import { Storage } from "./utils/storage";
import Page from "./utils/page";

/**组件 */
import Header from "./parts/Header.vue";
import WorkSpace from "./parts/WorkSpace.vue";
import FileManager from "./parts/FileManager.vue";
import JsonViewer from "./parts/JsonViewer.vue";

/** */
</script>
