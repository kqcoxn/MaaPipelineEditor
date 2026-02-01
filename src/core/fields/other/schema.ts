import { FieldTypeEnum } from "../fieldTypes";
import type { FieldType } from "../types";

/**
 * 其他字段 Schema 定义
 */
export const otherFieldSchema: Record<string, FieldType> = {
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
    desc: "next 列表循环识别的超时时间，毫秒。可选，默认 20 * 1000（20 秒）。 设置为 -1 表示无限等待，永不超时。 具体逻辑为 while(!timeout) { foreach(next); sleep_until(rate_limit); } 。",
  },
  anchor: {
    key: "anchor",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
    default: [""],
    desc: "锚点名称。可选，默认空。 当节点执行成功后，会将该锚点名设置为当前节点。多个节点可设置同一个锚点名，后执行的会覆盖先执行的。 在 next 或 on_error 中可通过 [Anchor] 属性引用该锚点，运行时会解析为最后设置该锚点的节点。 详见 节点属性。",
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
  maxHit: {
    key: "max_hit",
    type: FieldTypeEnum.Int,
    default: 1,
    desc: "该节点最多可被识别成功多少次。可选，默认 UINT_MAX ，即无限制。 若超过该次数，其他 node 的 next 列表中的该 node 会被跳过，既不会被识别也不会被执行。",
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
    params: [
      {
        key: "time",
        type: FieldTypeEnum.Int,
        default: 1,
        desc: "连续 time 毫秒画面没有较大变化才会退出动作。可选，默认 1。",
        displayName: "time",
      },
      {
        key: "target",
        type: FieldTypeEnum.Any,
        default: true,
        desc: "等待目标的位置。可选，默认 true。值同 Click.target。",
        displayName: "target",
      },
      {
        key: "target_offset",
        type: FieldTypeEnum.XYWH,
        default: [0, 0, 0, 0],
        desc: "在 target 的基础上额外移动再作为等待目标，四个值分别相加。可选，默认 [0, 0, 0, 0]。",
        displayName: "offset",
      },
      {
        key: "threshold",
        type: FieldTypeEnum.Double,
        default: 0.95,
        step: 0.01,
        desc: "判断'没有较大变化'的模板匹配阈值。可选，默认 0.95。",
        displayName: "threshold",
      },
      {
        key: "method",
        type: FieldTypeEnum.Int,
        default: 5,
        desc: "判断'没有较大变化'的模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5。",
        displayName: "method",
      },
      {
        key: "rate_limit",
        type: FieldTypeEnum.Int,
        default: 1000,
        step: 500,
        desc: "识别速率限制，单位毫秒。可选，默认 1000。每次识别最低消耗 rate_limit 毫秒。",
        displayName: "rate_limit",
      },
      {
        key: "timeout",
        type: FieldTypeEnum.Int,
        default: 20000,
        step: 1000,
        desc: "识别超时时间，毫秒。可选，默认 20000。",
        displayName: "timeout",
      },
    ],
  },
  postWaitFreezes: {
    key: "post_wait_freezes",
    type: [FieldTypeEnum.Int, FieldTypeEnum.Any],
    default: 0,
    desc: "行动动作后 到 识别 next，等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。 连续 pre_wait_freezes 毫秒 画面 没有较大变化 才会退出动作。 若为 object，可设置更多参数，详见 等待画面静止。 具体的顺序为 pre_wait_freezes - pre_delay - action - post_wait_freezes - post_delay 。",
    params: [
      {
        key: "time",
        type: FieldTypeEnum.Int,
        default: 1,
        desc: "连续 time 毫秒画面没有较大变化才会退出动作。可选，默认 1。",
        displayName: "time",
      },
      {
        key: "target",
        type: FieldTypeEnum.Any,
        default: true,
        desc: "等待目标的位置。可选，默认 true。值同 Click.target。",
        displayName: "target",
      },
      {
        key: "target_offset",
        type: FieldTypeEnum.XYWH,
        default: [0, 0, 0, 0],
        desc: "在 target 的基础上额外移动再作为等待目标，四个值分别相加。可选，默认 [0, 0, 0, 0]。",
        displayName: "offset",
      },
      {
        key: "threshold",
        type: FieldTypeEnum.Double,
        default: 0.95,
        step: 0.01,
        desc: "判断'没有较大变化'的模板匹配阈值。可选，默认 0.95。",
        displayName: "threshold",
      },
      {
        key: "method",
        type: FieldTypeEnum.Int,
        default: 5,
        desc: "判断'没有较大变化'的模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5。",
        displayName: "method",
      },
      {
        key: "rate_limit",
        type: FieldTypeEnum.Int,
        default: 1000,
        step: 500,
        desc: "识别速率限制，单位毫秒。可选，默认 1000。每次识别最低消耗 rate_limit 毫秒。",
        displayName: "rate_limit",
      },
      {
        key: "timeout",
        type: FieldTypeEnum.Int,
        default: 20000,
        step: 1000,
        desc: "识别超时时间，毫秒。可选，默认 20000。",
        displayName: "timeout",
      },
    ],
  },
  focus: {
    key: "focus",
    type: FieldTypeEnum.Any,
    default: "",
    desc: "关注节点，会额外产生部分回调消息。可选，默认 null，不产生回调消息。详见 节点通知。",
    params: [
      {
        key: "Node.Recognition.Starting",
        type: FieldTypeEnum.String,
        default: "",
        desc: "识别开始时触发。可用占位符: task_id, reco_id, name",
        displayName: "Reco.Start",
      },
      {
        key: "Node.Recognition.Succeeded",
        type: FieldTypeEnum.String,
        default: "",
        desc: "识别成功时触发。可用占位符: task_id, reco_id, name",
        displayName: "Reco.OK",
      },
      {
        key: "Node.Recognition.Failed",
        type: FieldTypeEnum.String,
        default: "",
        desc: "识别失败时触发。可用占位符: task_id, reco_id, name",
        displayName: "Reco.Fail",
      },
      {
        key: "Node.Action.Starting",
        type: FieldTypeEnum.String,
        default: "",
        desc: "动作开始时触发。可用占位符: task_id, action_id, name",
        displayName: "Action.Start",
      },
      {
        key: "Node.Action.Succeeded",
        type: FieldTypeEnum.String,
        default: "",
        desc: "动作成功时触发。可用占位符: task_id, action_id, name",
        displayName: "Action.OK",
      },
      {
        key: "Node.Action.Failed",
        type: FieldTypeEnum.String,
        default: "",
        desc: "动作失败时触发。可用占位符: task_id, action_id, name",
        displayName: "Action.Fail",
      },
    ],
  },
  repeat: {
    key: "repeat",
    type: FieldTypeEnum.Int,
    default: 2,
    desc: "动作重复执行次数。可选，默认 1 ，即不重复。 执行流程为 action - [repeat_wait_freezes - repeat_delay - action] × (repeat-1) 。",
  },
  repeatDelay: {
    key: "repeat_delay",
    type: FieldTypeEnum.Int,
    default: 200,
    desc: "每次重复动作之间的延迟，毫秒。可选，默认 0 。 仅当 repeat > 1 时生效，在第二次及之后的每次动作执行前等待。",
  },
  repeatWaitFreezes: {
    key: "repeat_wait_freezes",
    type: [FieldTypeEnum.Int, FieldTypeEnum.Any],
    default: 200,
    desc: "每次重复动作之间等待画面不动了的时间，毫秒。可选，默认 0 ，即不等待。 仅当 repeat > 1 时生效，在第二次及之后的每次动作执行前等待画面静止。 若为 object，可设置更多参数，详见 等待画面静止。",
    params: [
      {
        key: "time",
        type: FieldTypeEnum.Int,
        default: 1,
        desc: "连续 time 毫秒画面没有较大变化才会退出动作。可选，默认 1。",
        displayName: "time",
      },
      {
        key: "target",
        type: FieldTypeEnum.Any,
        default: true,
        desc: "等待目标的位置。可选，默认 true。值同 Click.target。",
        displayName: "target",
      },
      {
        key: "target_offset",
        type: FieldTypeEnum.XYWH,
        default: [0, 0, 0, 0],
        desc: "在 target 的基础上额外移动再作为等待目标，四个值分别相加。可选，默认 [0, 0, 0, 0]。",
        displayName: "offset",
      },
      {
        key: "threshold",
        type: FieldTypeEnum.Double,
        default: 0.95,
        step: 0.01,
        desc: "判断'没有较大变化'的模板匹配阈值。可选，默认 0.95。",
        displayName: "threshold",
      },
      {
        key: "method",
        type: FieldTypeEnum.Int,
        default: 5,
        desc: "判断'没有较大变化'的模板匹配算法，即 cv::TemplateMatchModes。可选，默认 5。",
        displayName: "method",
      },
      {
        key: "rate_limit",
        type: FieldTypeEnum.Int,
        default: 1000,
        step: 500,
        desc: "识别速率限制，单位毫秒。可选，默认 1000。每次识别最低消耗 rate_limit 毫秒。",
        displayName: "rate_limit",
      },
      {
        key: "timeout",
        type: FieldTypeEnum.Int,
        default: 20000,
        step: 1000,
        desc: "识别超时时间，毫秒。可选，默认 20000。",
        displayName: "timeout",
      },
    ],
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
export const otherFieldParamsWithoutFocus: FieldType[] = [
  otherFieldSchema.rateLimit,
  otherFieldSchema.timeout,
  otherFieldSchema.preDelay,
  otherFieldSchema.postDelay,
  otherFieldSchema.anchor,
  otherFieldSchema.maxHit,
  otherFieldSchema.enabled,
  otherFieldSchema.inverse,
  otherFieldSchema.repeat,
  otherFieldSchema.repeatDelay,
  otherFieldSchema.attach,
];

/**
 * WaitFreezes 相关字段（需要单独处理 int/object 双模式）
 */
export const waitFreezesFields = [
  otherFieldSchema.preWaitFreezes,
  otherFieldSchema.postWaitFreezes,
  otherFieldSchema.repeatWaitFreezes,
];

/**
 * 其他字段参数列表
 */
export const otherFieldParams: FieldType[] = [
  otherFieldSchema.rateLimit,
  otherFieldSchema.timeout,
  otherFieldSchema.preDelay,
  otherFieldSchema.postDelay,
  otherFieldSchema.anchor,
  otherFieldSchema.maxHit,
  otherFieldSchema.focus,
  otherFieldSchema.enabled,
  otherFieldSchema.inverse,
  otherFieldSchema.preWaitFreezes,
  otherFieldSchema.postWaitFreezes,
  otherFieldSchema.repeat,
  otherFieldSchema.repeatDelay,
  otherFieldSchema.repeatWaitFreezes,
  otherFieldSchema.attach,
];
