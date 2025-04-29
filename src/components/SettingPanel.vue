<style lang="scss" scoped>
#SettingPanel {
  position: absolute;
}
</style>

<template>
  <div :id="appName">
    <el-drawer
      v-model="stateStore.isShowSettingPanel"
      title="文件设置"
      direction="rtl"
      @close="handleClose"
      @open="handleOpen"
    >
      <el-form label-width="auto">
        <el-form-item label="节点前缀">
          <el-input
            v-model="fileStore.currentConfig.prefix"
            placeholder="转换后：prefix_label"
            clearable
          />
        </el-form-item>
        <el-form-item label="任务错误出口">
          <el-input
            v-model="fileStore.currentConfig.export"
            placeholder="留空表示直接结束"
            clearable
          />
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("SettingPanel");
// 控件
// 状态
// 数据
const data = ref({});

/**属性 */
/**函数 */

/**监听 */
// 挂载
onMounted(async () => {});

function handleOpen() {}
function handleClose() {}

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted } from "vue";
// pinia
import { useStateStore } from "../stores/stateStore";
const stateStore = useStateStore();
import { useFileStore } from "../stores/fileStore";
const fileStore = useFileStore();
/**组件 */

/** */
</script>
