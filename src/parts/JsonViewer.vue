<style lang="scss" scoped>
#JsonViewer {
  width: 30%;
  height: 100%;
  border-left: 1px solid #ccc;

  .container {
    height: 100%;
    width: 100%;
    padding: 8px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  .title {
    font-size: 18px;
  }

  .operates {
    height: 30px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    border-bottom: solid 1px #ccc;

    .iconfont {
      font-size: 18px;
    }
  }

  .viewer {
    margin-top: 6px;
    flex: 1;
    height: 100%;
    overflow: hidden;

    .editor {
      overflow-y: auto;
      height: calc(100vh - 180px);
    }
  }
}
</style>

<template>
  <div :id="appName">
    <div class="container">
      <div class="title text-center">JSON预览</div>
      <div class="operates">
        <span
          class="iconfont icon-fuzhi icon-effect"
          @click="Payaboard.copy(fileStore.currentJson)"
        ></span>
        <span
          class="iconfont icon-daoru icon-effect"
          @click="loadFromCopy"
        ></span>
      </div>
      <div class="viewer">
        <vue-json-pretty
          class="editor"
          :data="jsonData"
          :showLineNumber="true"
          :showDoubleQuotes="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("JsonViewer");
// 控件
// 状态
// 数据

/**属性 */
const jsonData = computed(() => {
  return fileStore.currentJson;
});

/**函数 */
async function loadFromCopy() {
  const jsonStr = await Payaboard.paste();
  if (!Transfer.jsonToNodes(jsonStr)) return;
}

/**监听 */
// 挂载
onMounted(async () => {
  watch(() => nodeStore.nodes, onNodeChange, { deep: true });
  watch(() => nodeStore.edges, onNodeChange, { deep: true });
  watch(
    () => fileStore.currentName,
    (newValue, oldValue) => {
      if (oldValue == null || fileStore.findIndex(oldValue) != -1) return;
      onNodeChange();
      Storage.remove(oldValue);
    }
  );
});

// 监测变化
function onNodeChange() {
  const jsonObj = Transfer.nodeToJsonObj(
    fileStore.currentName,
    nodeStore.edges
  );
  fileStore.currentFile.json = jsonObj;
  Storage.save(fileStore.currentName, jsonObj);
}

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted, watch } from "vue";
// json-editor
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
// pinia
import { useFileStore } from "../stores/fileStore";
const fileStore = useFileStore();
import { useNodeStore } from "../stores/nodeStore";
const nodeStore = useNodeStore();
// core
import Transfer from "../core/transfer";
// utils
import { Payaboard, Storage } from "../utils/storage";

/**组件 */

/** */
</script>
