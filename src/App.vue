<style lang="scss" scoped>
#App {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .main {
    display: flex;

    .place {
      display: flex;
      flex-direction: column;

      .workspace {
        flex: 1;
      }

      .tips {
        border-top: solid 1px #ccc;
        height: auto;
        padding: 10px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        p {
          color: red;
        }
      }
    }
  }
}
</style>

<template>
  <div :id="appName">
    <Header class="header" />
    <FileManager />
    <div class="main fill">
      <div class="place fill">
        <WorkSpace class="worlspace" />
        <div class="tips" v-if="stateStore.tips.length">
          <p v-for="(tip, index) in stateStore.tips">*{{ tip }}</p>
        </div>
      </div>
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
  // 初始化
  onInit((i) => {
    viewer.value = i;
    Page.updateVueFlow(i);
  });
  nextTick(() => {
    fileStore.clear();
    let exist = Storage.load(
      (filename, jsonObj) => {
        fileStore.addFile(filename);
        Transfer.jsonToNodes(jsonObj, false);
        setTimeout(() => {
          if (viewer.value) {
            Page.focus({ padding: 0.1 });
          }
        }, 100);
      },
      () => {
        nodeStore.nodeCounter = 1;
      }
    );
    if (!exist) {
      fileStore.addFile(null);
      setTimeout(() => {
        if (viewer.value) {
          Page.focus({ padding: 0.1 });
        }
      }, 100);
    }
  });

  // 注册事件
  // document.addEventListener("keydown", handleKeyDown, { passive: false });
});

// 快捷键
function handleKeyDown(event) {
  const ctrlKey = event.ctrlKey;
  switch (event.key) {
    // 复制
    case "c":
      if (ctrlKey && nodeStore.currentNodeId) {
        console.log("复制");
        event.preventDefault();
      }
      break;
  }
}

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
import { useStateStore } from "./stores/stateStore";
const stateStore = useStateStore();
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
