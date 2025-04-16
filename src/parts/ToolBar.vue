<style lang="scss" scoped>
#ToolBar {
  width: 100%;
  height: 100%;
  position: absolute;

  .bar {
    position: absolute;
    z-index: 10;
    background-color: white;
    border-radius: 8px;
    overflow: hidden;
    border-right: solid 1px #ccc;
    box-shadow: 0 0 5px #ccc;
    display: flex;
    flex-direction: column;

    .item {
      width: 50px;
      height: 50px;

      .content {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: white;

        &:hover {
          background-color: rgba($color: gray, $alpha: 0.1);
        }

        .icon {
          font-size: 28px;
        }
      }

      .divider {
        position: absolute;
        z-index: 1;
        background-color: rgba($color: gray, $alpha: 0.4);
        border-radius: 1px;
      }
    }
  }

  .nodes {
    left: 10px;
    top: 10px;

    .divider {
      width: 70%;
      height: 1px;
      top: 0;
    }
  }

  .filename {
    position: absolute;
    z-index: 1;
    left: 70px;
    top: 10px;
    box-shadow: 0 0 5px #ccc;
    width: 180px;
  }

  .tools {
    right: 10px;
    top: 10px;
    flex-direction: row;

    .divider {
      width: 1px;
      height: 70%;
      left: 0;
    }
  }
}
</style>

<template>
  <div :id="appName">
    <!-- 添加节点 -->
    <div class="bar nodes">
      <div
        v-for="(node, index) in nodes"
        class="item"
        @click="node.click ? node.click() : () => {}"
      >
        <el-tooltip effect="dark" :content="node.label" placement="right">
          <div class="content ease">
            <svg
              class="icon"
              :style="{
                fontSize: node.fontSize || '28px',
              }"
              aria-hidden="true"
            >
              <use :xlink:href="`#icon-${node.icon}`"></use>
            </svg>
            <div v-if="index > 0" class="divider"></div>
          </div>
        </el-tooltip>
      </div>
    </div>
    <!-- 文件名 -->
    <el-input
      class="filename"
      v-model="filename"
      placeholder="文件名不能为空！"
      @change="fileStore.changeName"
    />
    <!-- 工具 -->
    <div class="bar tools">
      <div
        v-for="(tool, index) in tools"
        class="item"
        @click="tool.click ? tool.click() : () => {}"
      >
        <el-tooltip effect="dark" :content="tool.label" placement="bottom">
          <div class="content ease">
            <svg
              class="icon"
              :style="{
                fontSize: `${tool.fontSize}px` || '28px',
              }"
              aria-hidden="true"
            >
              <use :xlink:href="`#icon-${tool.icon}`"></use>
            </svg>
            <div v-if="index > 0" class="divider"></div>
          </div>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("ToolBar");
// 控件
// 状态
// 数据
const filename = ref("");

/**属性 */
/**函数 */

/**监听 */
// 挂载
onMounted(async () => {
  watch(
    () => fileStore.currentName,
    (newValue) => {
      filename.value = newValue;
    }
  );
});

/**常量 */
// 添加节点
const nodes = [
  {
    label: "空节点",
    icon: "kongjiedian",
    click: () => {
      nodeStore.addNode("DirectHit", "DoNothing", {
        viewer: props.viewer,
        autoSelect: true,
        autoConnect: true,
      });
    },
  },
  {
    label: "区域点击节点",
    icon: "dianji",
    click: () => {
      const node = nodeStore.addNode("DirectHit", "Click", {
        viewer: props.viewer,
        autoSelect: true,
        autoConnect: true,
      });
      node.data.target = [0, 0, 1, 1];
    },
  },
  {
    label: "OCR 节点",
    icon: "ocr",
    click: () => {
      const node = nodeStore.addNode("OCR", "Click", {
        viewer: props.viewer,
        autoSelect: true,
        autoConnect: true,
      });
      node.data.expected = [""];
    },
  },
  {
    label: "图像识别节点",
    icon: "tuxiang",
    click: () => {
      const node = nodeStore.addNode("TemplateMatch", "Click", {
        viewer: props.viewer,
        autoSelect: true,
        autoConnect: true,
      });
      node.data.template = ["../image/"];
    },
  },
];

// 工具
const tools = [
  {
    label: "新建文件",
    icon: "xinjiantianjia",
    fontSize: 24,
    click: () => fileStore.addFile(null, { isTip: true, autoFit: true }),
  },
  {
    label: "通用设置",
    icon: "a-080_shezhi",
    fontSize: 32,
  },
];

/**参数 */
const props = defineProps({
  viewer: {},
});

/**导入 */
// vue
import { ref, computed, onMounted, watch } from "vue";
// pinia
import { useFileStore } from "../stores/fileStore";
const fileStore = useFileStore();
import { useNodeStore } from "../stores/nodeStore";
const nodeStore = useNodeStore();
// utils
import { Storage } from "../utils/storage";

/**组件 */

/** */
</script>
