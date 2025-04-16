<style lang="scss" scoped>
#AttrPanel {
  position: absolute;
  top: 70px;
  right: 10px;
  z-index: 1;

  .container {
    width: 380px;
    background-color: white;
    border-radius: 6px;
    box-sizing: border-box;
    padding: 12px 16px;
    box-shadow: 0 0 5px #ccc;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-size: 18px;
      flex: 1;
    }

    .left,
    .right {
      width: 20%;
      display: flex;
      gap: 6px;
    }

    .right {
      justify-content: right;
    }

    .icon {
      font-size: 20px;
    }

    .copy {
      font-size: 22px;
    }
  }

  .list {
    margin-top: 12px;
    max-height: 70vh;
    overflow-y: auto;

    :deep(.item) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 4px;
      box-sizing: border-box;
      padding: 4px;

      &:hover {
        background-color: #f0f0f0;
      }

      .key {
        width: 96px;
        text-align: right;
      }

      .value {
        margin-left: 12px;
        flex: 1;
      }

      .operates {
        margin-left: 12px;
        display: flex;
        justify-content: right;
        align-items: center;

        .add {
          font-size: 18px;
        }
      }
    }
  }
}
</style>

<template>
  <div :id="appName">
    <div v-if="isShow" class="container">
      <div class="header">
        <div class="left">
          <svg
            class="icon copy-content icon-effect"
            aria-hidden="true"
            @click="copyData"
          >
            <use xlink:href="#icon-a-copyfubenfuzhi"></use>
          </svg>
          <svg
            class="icon copy-title icon-effect"
            aria-hidden="true"
            @click="copyTitle"
          >
            <use xlink:href="#icon-xiaohongshubiaoti"></use>
          </svg>
        </div>
        <div class="title text-center">节点字段</div>
        <div class="right">
          <svg
            class="icon copy icon-effect"
            aria-hidden="true"
            @click="nodeStore.copyNode"
          >
            <use xlink:href="#icon-beifen"></use>
          </svg>
          <svg
            class="icon hide icon-effect"
            aria-hidden="true"
            @click="nodeStore.currentNodeId = null"
          >
            <use xlink:href="#icon-dituweizhixinxi_chahao"></use>
          </svg>
        </div>
      </div>
      <div class="list">
        <!-- 标签 -->
        <div class="item ease">
          <el-popover
            title="label"
            content="节点名，同时作为转换后的key值，必填"
            placement="left"
            :width="240"
          >
            <template #reference>
              <div class="key ellipsis bold">label</div>
            </template>
          </el-popover>
          <el-input
            class="value"
            v-model="nodeData.label"
            style="width: 240px"
            placeholder="节点名不能为空！"
          />
        </div>
        <!-- 识别算法 -->
        <div class="item">
          <el-popover
            title="recognition"
            content="识别算法类型，必填"
            placement="left"
            :width="240"
          >
            <template #reference>
              <div class="key ellipsis bold">recognition</div>
            </template>
          </el-popover>
          <el-select
            class="value"
            v-model="nodeData.recognition"
            @change="onRecognitionChange"
          >
            <el-option
              v-for="option in Object.keys(recognitionFields)"
              :key="option"
              :label="option"
              :value="option"
            />
          </el-select>
          <div
            class="operates"
            v-if="recognitionFields[nodeData.recognition]?.extras"
          >
            <el-dropdown placement="bottom">
              <svg class="icon add" aria-hidden="true">
                <use xlink:href="#icon-a-addmusic"></use>
              </svg>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="item in Object.keys(
                      recognitionFields[nodeData.recognition].extras
                    )"
                    @click="
                      addField(
                        item,
                        recognitionFields[nodeData.recognition].extras[item]
                      )
                    "
                    ><el-popover
                      :title="item"
                      :content="
                        recognitionFields[nodeData.recognition].extras[item]
                          .description
                      "
                      placement="right"
                      :offset="34"
                      :width="240"
                    >
                      <template #reference>
                        <div class="fill">{{ item }}</div>
                      </template>
                    </el-popover></el-dropdown-item
                  >
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <!-- 识别附属 -->
        <AttrFieldItem
          v-for="item in Object.keys(
            recognitionFields[nodeData.recognition]?.extras || {}
          ).filter((extra) => Object.keys(nodeData).includes(extra))"
          :key="item"
          :fieldKey="item"
          :fieldType="recognitionFields[nodeData.recognition].extras[item]"
          class="item"
        />
        <!-- 执行动作 -->
        <div class="item">
          <el-popover
            title="action"
            content="执行的动作，必填"
            placement="left"
            :width="240"
          >
            <template #reference>
              <div class="key ellipsis bold">action</div>
            </template>
          </el-popover>
          <el-select
            class="value"
            v-model="nodeData.action"
            @change="onActionChange"
          >
            <el-option
              v-for="option in Object.keys(actionFields)"
              :key="option"
              :label="option"
              :value="option"
            />
          </el-select>
          <div class="operates" v-if="actionFields[nodeData.action]?.extras">
            <el-dropdown placement="bottom">
              <svg class="icon add" aria-hidden="true">
                <use xlink:href="#icon-a-addmusic"></use>
              </svg>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="item in Object.keys(
                      actionFields[nodeData.action].extras
                    )"
                    @click="
                      addField(item, actionFields[nodeData.action].extras[item])
                    "
                    ><el-popover
                      :title="item"
                      :content="
                        actionFields[nodeData.action].extras[item].description
                      "
                      placement="right"
                      :offset="34"
                      :width="240"
                    >
                      <template #reference>
                        <div class="fill">{{ item }}</div>
                      </template>
                    </el-popover></el-dropdown-item
                  >
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <!-- 执行附属 -->
        <AttrFieldItem
          v-for="item in Object.keys(
            actionFields[nodeData.action]?.extras || {}
          ).filter((extra) => Object.keys(nodeData).includes(extra))"
          :key="item"
          :fieldKey="item"
          :fieldType="actionFields[nodeData.action].extras[item]"
          class="item"
        />
        <!-- 其他 -->
        <div class="item">
          <div class="key bold">others</div>
          <div class="value text-center">─────────────────</div>
          <div class="operates">
            <el-dropdown placement="bottom">
              <svg class="icon add" aria-hidden="true">
                <use xlink:href="#icon-a-addmusic"></use>
              </svg>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="item in Object.keys(extraFields)"
                    @click="addField(item, extraFields[item])"
                    ><el-popover
                      :title="item"
                      :content="extraFields[item].description"
                      placement="right"
                      :offset="34"
                      :width="240"
                    >
                      <template #reference>
                        <div class="fill">{{ item }}</div>
                      </template>
                    </el-popover></el-dropdown-item
                  >
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <AttrFieldItem
          v-for="item in Object.keys(extraFields || {}).filter((extra) =>
            Object.keys(nodeData).includes(extra)
          )"
          :key="item"
          :fieldKey="item"
          :fieldType="extraFields[item]"
          class="item"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
/**变量 */
const appName = ref("AttrPanel");
// 控件
// 状态
// 数据

/**属性 */
const isShow = computed(() => {
  return nodeStore.currentNode?.type == "template";
});
const nodeData = computed(() => {
  return nodeStore.currentNode?.data || {};
});
const transNodeName = computed(() => {
  return fileStore?.currentName + "_" + nodeStore.currentNode?.data?.label;
});
const transNode = computed(() => {
  return fileStore?.currentJson[transNodeName.value] || {};
});

/**函数 */
// 复制
function copyTitle() {
  Payaboard.copy(transNodeName.value);
}
function copyData() {
  Payaboard.copy(`"${transNodeName.value}":${JSON.stringify(transNode.value)}`);
}

// 添加字段
function addField(key, type) {
  const typeParser = new TypeParser(type.type);
  switch (typeParser.type) {
    case "list":
      nodeData.value[key] = [...type.default];
      break;
    default:
      nodeData.value[key] = type.default;
  }
}

/**监听 */
// 挂载
onMounted(async () => {});

// 添加必选
function onRecognitionChange(value) {
  const extras = recognitionFields[value].extras;
  if (!extras) return;
  Object.keys(extras).forEach((key) => {
    if (!extras[key].required) return;
    addField(key, extras[key]);
  });
}
function onActionChange(value) {
  const extras = actionFields[value].extras;
  if (!extras) return;
  Object.keys(extras).forEach((key) => {
    if (!extras[key].required) return;
    addField(key, extras[key]);
  });
}

/**常量 */
/**参数 */
/**导入 */
// vue
import { ref, computed, onMounted } from "vue";
// pinia
import { useNodeStore } from "../stores/nodeStore";
const nodeStore = useNodeStore();
import { useFileStore } from "../stores/fileStore";
const fileStore = useFileStore();
// fields
import { recognitionFields } from "../fields/recognitions";
import { actionFields } from "../fields/actions";
import { extraFields } from "../fields/extras";
import { TypeParser } from "../fields/types";
// utils
import { Payaboard } from "../utils/storage";
import { TopNotice } from "../utils/notice";

/**组件 */
import AttrFieldItem from "./AttrFieldItem.vue";

/** */
</script>
