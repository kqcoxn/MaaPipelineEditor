<style lang="scss" scoped>
#Header {
  width: 100%;
  height: 60px;
  box-shadow: 1px 1px 5px 2px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;

  > div {
    width: 100%;
    display: flex;
    align-items: center;
  }

  .left {
    .logo {
      width: 28px;
      height: 28px;
      margin-left: 16px;
      border-radius: 50px;
    }

    .title {
      margin-left: 12px;
      font-size: 18px;
    }

    .tag {
      margin-left: 6px;
    }
  }

  .right {
    justify-content: right;

    .github {
      margin-right: 12px;
      font-size: 32px;
    }
  }
}
</style>

<template>
  <div :id="appName">
    <!-- 左侧 -->
    <div class="left pointer" @click="Page.refresh()">
      <div class="logo img-container">
        <img src="../assets/logo.png" />
      </div>
      <div class="title">YAMaaPE - Maa Pipeline 可视化工作流式编辑器</div>
      <el-tag class="tag" type="danger" effect="dark" size="small" round>
        Beta-0.1.0
      </el-tag>
    </div>
    <!-- 右侧 -->
    <div class="right">
      <span
        class="iconfont icon-githublogo github icon-effect"
        @click="Page.go(`https://github.com/kqcoxn/YAMaaPE`, false)"
      ></span>
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("Header");
// 控件
// 状态
// 数据

/**属性 */
/**函数 */

/**监听 */
// 挂载
onMounted(async () => {});

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted } from "vue";
// utils
import Page from "../utils/page";

/**组件 */

/** */
</script>
