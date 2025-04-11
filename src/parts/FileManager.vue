<style lang="scss" scoped>
#PageManager {
  width: 100%;

  .tabs {
    > :deep(.el-tabs__header) {
      margin: 0 !important;
    }

    .add {
      font-size: 22px;
    }
  }
}
</style>

<template>
  <div :id="appName">
    <el-tabs
      v-model="fileStore.currentName"
      type="card"
      class="tabs"
      closable
      @tab-remove="removeTab"
      @tab-change="fileStore.switchFile"
      @tab-click="onTabClick"
    >
      <el-tab-pane
        v-for="file in fileStore.files"
        :key="file.name"
        :label="file.name"
        :name="file.name"
      >
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("PageManager");
// 控件
// 状态
// 数据

/**属性 */
/**函数 */
// 移除标签
function removeTab(targetName) {
  fileStore.removeFile(targetName);
}

/**监听 */
// 挂载
onMounted(async () => {});

function onTabClick() {
  setTimeout(() => {
    Page.focus({ padding: 0.1 });
  }, 100);
}

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted } from "vue";
// pinia
import { useFileStore } from "../stores/fileStore";
const fileStore = useFileStore();
// utils
import Page from "../utils/page";

/**组件 */

/** */
</script>
