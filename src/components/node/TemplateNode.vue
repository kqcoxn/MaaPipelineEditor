<style lang="scss" scoped>
#TemplateNode {
  width: 210px;
  box-sizing: border-box;
  padding: 12px;
  border: solid 1px #ccc;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;

  .add {
    width: 100%;
    height: 16px;
  }

  .fields {
    margin-top: 8px;

    .field {
      width: 100%;
      background-color: #f0f0f0;
      box-sizing: border-box;
      border-radius: 4px;
      padding: 4px;
      font-size: 10px;
      display: flex;
      height: 26px;
      margin-top: 4px;

      .key {
        width: 60px;
        text-align: right;
        line-height: 18px;
      }

      .value {
        margin-left: 4px;
        flex: 1;

        .value-container {
          width: 99%;
          height: 99%;
          border-radius: 4px;
          background-color: white;
          overflow: hidden;
          display: flex;
          align-items: center;
          box-sizing: border-box;
          padding: 0 4px;
        }
      }
    }
  }

  .handles {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;

    > div {
      position: absolute;
      height: 100%;

      .source {
        &:nth-child(1) {
          top: 25%;
        }
        &:nth-child(2) {
          top: 50%;
        }
        &:nth-child(3) {
          top: 75%;
        }
      }
    }

    .source {
      right: 0;
    }

    .target {
      background-color: var(--edge-color-target);
    }

    .next {
      background-color: var(--edge-color-next);
    }

    .interrupt {
      background-color: var(--edge-color-interrupt);
    }

    .error {
      background-color: var(--edge-color-error);
    }

    .vue-flow__handle {
      height: 18px;
      width: 8px;
      border-radius: 4px;
    }
  }
}
.selected {
  border: 1px solid black !important;
}
</style>

<template>
  <div :id="appName" :class="[{ selected: selected }, { ease: true }]">
    <!-- 内容 -->
    <div class="label text-center">
      {{ data.label }}
    </div>
    <div class="fields">
      <div v-for="field in validFields" class="field">
        <div class="key ellipsis">{{ field }}</div>
        <div class="value">
          <div class="value-container block-center">
            <div class="text ellipsis">
              {{ data[field] }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 节点 -->
    <div class="handles">
      <div class="source">
        <Handle id="next" type="source next" :position="Right" />
        <Handle id="interrupt" type="source interrupt" :position="Right" />
        <Handle id="on_error" type="source error" :position="Right" />
      </div>
      <div class="target">
        <Handle id="target" type="target" :position="Left" />
      </div>
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("TemplateNode");
// 控件
// 状态
// 数据

/**属性 */
const selected = computed(() => {
  return props.id == nodeStore.currentNodeId;
});
const validFields = computed(() => {
  return Object.keys(Transfer.getValidFields(props.data));
});

/**函数 */

/**监听 */
// 挂载
onMounted(async () => {});

/**常量 */
const Left = Position.Left;
const Right = Position.Right;
/**参数 */
const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
});
/**导入 */
// vue
import { ref, computed, onMounted } from "vue";
// flow
import { Handle, Position, useVueFlow } from "@vue-flow/core";
// pinia
import { useNodeStore } from "../../stores/nodeStore";
const nodeStore = useNodeStore();
// core
import Transfer from "../../core/transfer";

/**组件 */

/** */
</script>
