<style lang="scss" scoped>
#AttrFieldItem {
  .numberList {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: repeat(2, 1fr);
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;

    .item {
      width: 100%;
      height: 100%;
    }
  }

  .customList {
    width: 100%;

    .item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 !important;

      &:not(:first-child) {
        margin-top: 4px;
      }

      .operates {
        margin-left: 12px;
        display: flex;
        justify-content: right;
        align-items: center;
        gap: 8px;

        .trash {
          font-size: 16px;
        }

        .add {
          font-size: 18px;
        }
      }
    }
  }

  .input {
    width: 100%;
  }
}
</style>

<template>
  <div :id="appName">
    <el-popover
      :title="fieldKey"
      :content="fieldType.description"
      placement="left"
      :width="280"
    >
      <template #reference>
        <div class="key ellipsis">{{ fieldKey }}</div>
      </template>
    </el-popover>
    <div v-if="value != null" class="value">
      <!-- 数组 -->
      <div v-if="typeParser.type == 'list'">
        <!-- 无限列表 -->
        <div v-if="typeParser.isCustomLength" class="customList">
          <div v-for="(item, index) in value" class="item">
            <el-input-number
              v-if="typeParser.listType == 'number'"
              class="input"
              v-model="value[index]"
              controls-position="right"
            />
            <el-input v-else v-model="value[index]" controls-position="right" />
            <div class="operates">
              <svg
                v-if="value.length > 1"
                class="icon trash icon-effect"
                aria-hidden="true"
                @click="removeList(index)"
              >
                <use xlink:href="#icon-lanzilajitongshanchu"></use>
              </svg>
              <svg
                v-if="index == value.length - 1"
                class="icon add icon-effect"
                aria-hidden="true"
                @click="addList"
              >
                <use xlink:href="#icon-a-addmusic"></use>
              </svg>
            </div>
          </div>
        </div>
        <!-- 数组列表 -->
        <div v-else-if="typeParser.listType == 'number'" class="numberList">
          <el-input-number
            v-for="(item, index) in typeParser.listLength"
            class="item"
            v-model="value[index]"
            controls-position="right"
          />
        </div>
      </div>
      <!-- 字符串类型 -->
      <div v-else-if="typeParser.type == 'string'">
        <el-input v-model="value" />
      </div>
      <!-- 数字类型 -->
      <div v-else-if="typeParser.type == 'number'">
        <el-input-number
          class="input"
          v-model="value"
          controls-position="right"
        />
      </div>
      <!-- 布尔类型 -->
      <div v-else-if="typeParser.type == 'boolean'">
        <el-switch v-model="value" />
      </div>
      <!-- 枚举类型 -->
      <div v-else-if="typeParser.type == 'enum'">
        <el-select v-model="value" placeholder="Select">
          <el-option
            v-for="option in fieldType.options"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </div>
    </div>
    <div class="operates">
      <svg
        class="icon trash icon-effect"
        aria-hidden="true"
        @click="removeField"
      >
        <use xlink:href="#icon-lanzilajitongshanchu"></use>
      </svg>
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("AttrFieldItem");
// 控件
// 状态
// 数据
const typeParser = new TypeParser();
const value = ref(null);

/**属性 */
const nodeData = computed(() => {
  return nodeStore.currentNode?.data || {};
});

/**函数 */
function removeField() {
  delete nodeData.value[props.fieldKey];
}
function addList() {
  value.value.push(typeParser.type == "number" ? 0 : "");
}
function removeList(index) {
  value.value.splice(index, 1);
}

/**监听 */
// 挂载
onMounted(async () => {
  typeParser.init(props.fieldType.type);
  let defaultValue = null;
  switch (typeParser.type) {
    case "list":
      defaultValue = [...props.fieldType.default];
      break;
    default:
      defaultValue = props.fieldType.default;
  }
  value.value = nodeData.value[props.fieldKey] || defaultValue;
});

watch(
  value,
  (newValue) => {
    nodeData.value[props.fieldKey] = newValue;
    emit("update", value);
  },
  {
    deep: true,
  }
);

/**常量 */
/**参数 */
const props = defineProps({
  fieldKey: {
    type: String,
    required: true,
  },
  fieldType: {
    type: Object,
    required: true,
  },
});
const emit = defineEmits(["update"]);

/**导入 */
// vue
import { ref, computed, onMounted, watch } from "vue";
// fields
import { TypeParser } from "../fields/types";
// pinia
import { useNodeStore } from "../stores/nodeStore";
const nodeStore = useNodeStore();

/**组件 */

/** */
</script>
