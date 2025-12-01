import { FieldTypeEnum } from "../fieldTypes";
import type { FieldType } from "../types";

/**
 * 其他字段 Schema 定义
 */
const otherFieldSchema: Record<string, FieldType> = {
  rateLimit: {
    key: "rate_limit",
    type: FieldTypeEnum.Int,
    default: 1000,
    step: 500,
    desc: "识别速率限制，单位毫秒。可选，默认 1000 。 每轮识别 next 最低消耗 rate_limit 毫秒，不足的时间将会 sleep 等待。",
  },
  timeout: {
    key: "timeout",
    type: FieldTypeEnum.Int,
    default: 20000,
    step: 1000,
    desc: "next 识别超时时间，毫秒。可选，默认 20 * 1000 。 具体逻辑为 while(!timeout) { foreach(next); sleep_until(rate_limit); } 。",
  },
  inverse: {
    key: "inverse",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "反转识别结果，识别到了当做没识别到，没识别到的当做识别到了。可选，默认 false 。 请注意由此识别出的节点，Click 等动作的点击自身将失效（因为实际并没有识别到东西），若有需求可单独设置 target 。",
  },
  enabled: {
    key: "enabled",
    type: FieldTypeEnum.Bool,
    default: false,
    desc: "是否启用该 node。可选，默认 true 。 若为 false，其他 node 的 next 列表中的该 node 会被跳过，既不会被识别也不会被执行。",
  },
  preDelay: {
    key: "pre_delay",
    type: FieldTypeEnum.Int,
    default: 400,
    step: 100,
    desc: "识别到 到 执行动作前 的延迟，毫秒。可选，默认 200 。 推荐尽可能增加中间过程节点，少用延迟，不然既慢还不稳定。",
  },
  postDelay: {
    key: "post_delay",
    type: FieldTypeEnum.Int,
    default: 400,
    step: 100,
    desc: "执行动作后 到 识别 next 的延迟，毫秒。可选，默认 200 。 推荐尽可能增加中间过程节点，少用延迟，不然既慢还不稳定。",
  },
  preWaitFreezes: {
    key: "pre_wait_freezes",
    type: [FieldTypeEnum.Int, FieldTypeEnum.Any],
    default: 0,
    desc: "识别到 到 执行动作前，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。 连续 pre_wait_freezes 毫秒 画面 没有较大变化 才会退出动作。 若为 object，可设置更多参数，详见 等待画面静止。 具体的顺序为 pre_wait_freezes - pre_delay - action - post_wait_freezes - post_delay 。",
  },
  postWaitFreezes: {
    key: "post_wait_freezes",
    type: [FieldTypeEnum.Int, FieldTypeEnum.Any],
    default: 0,
    desc: "行动动作后 到 识别 next，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。 连续 pre_wait_freezes 毫秒 画面 没有较大变化 才会退出动作。 若为 object，可设置更多参数，详见 等待画面静止。 具体的顺序为 pre_wait_freezes - pre_delay - action - post_wait_freezes - post_delay 。",
  },
  focus: {
    key: "focus",
    type: FieldTypeEnum.Any,
    default: "",
    desc: "关注节点，会额外产生部分回调消息。可选，默认 null，不产生回调消息。 详见 节点通知。",
  },
  attach: {
    key: "attach",
    type: FieldTypeEnum.Any,
    default: {},
    desc: "附加 JSON 对象，用于保存节点的附加配置。可选，默认空对象。 该字段可用于存储自定义的配置信息，这些信息不会影响节点的执行逻辑，但可以通过相关接口获取。 注意：该字段会与默认值中的 attach 进行字典合并（dict merge），而不是覆盖。即节点中的 attach 会与默认值中的 attach 合并，相同键的值会被节点中的值覆盖，但其他键会保留。",
  },
};

/**
 * 其他字段 Schema 键列表
 */
export const otherFieldSchemaKeyList = Array.from(
  new Set(Object.values(otherFieldSchema).map((field) => field.key))
);

/**
 * 其他字段参数列表
 */
export const otherFieldParams: FieldType[] = [
  otherFieldSchema.rateLimit,
  otherFieldSchema.timeout,
  otherFieldSchema.preDelay,
  otherFieldSchema.postDelay,
  otherFieldSchema.focus,
  otherFieldSchema.enabled,
  otherFieldSchema.inverse,
  otherFieldSchema.preWaitFreezes,
  otherFieldSchema.postWaitFreezes,
  otherFieldSchema.attach,
];
