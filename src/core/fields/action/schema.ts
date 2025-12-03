import { FieldTypeEnum } from "../fieldTypes";
import type { FieldType } from "../types";

/**
 * 动作字段 Schema 定义
 */
export const actionFieldSchema: Record<string, FieldType> = {
  // 点击相关
  clickTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "点击目标的位置。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  targetOffset: {
    key: "target_offset",
    type: [FieldTypeEnum.XYWH, FieldTypeEnum.IntPair],
    default: [0, 0, 0, 0],
    desc: "在 target 的基础上额外移动再作为点击目标，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },

  // 长按相关
  longPressTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "长按目标的位置。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  longPressDuration: {
    key: "duration",
    type: FieldTypeEnum.Int,
    default: 1000,
    step: 100,
    desc: "长按持续时间，单位毫秒。可选，默认 1000 。",
  },

  // 滑动相关
  begin: {
    key: "begin",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "滑动起点。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  beginOffset: {
    key: "begin_offset",
    type: FieldTypeEnum.XYWH,
    default: [0, 0, 0, 0],
    desc: "在 begin 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },
  end: {
    key: "end",
    type: [
      FieldTypeEnum.PositionList,
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [[0, 0, 0, 0]],
    desc: "滑动终点。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。v4.5.x 版本新增支持 list，可用于添加滑动途径点！相较多次 swipe 的区别是多个 end 之间不会抬手，即一次折线滑动。",
  },
  endOffset: {
    key: "end_offset",
    type: [FieldTypeEnum.XYWHList, FieldTypeEnum.XYWH],
    default: [[0, 0, 0, 0]],
    desc: "在 end 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。",
  },
  swipeDuration: {
    key: "duration",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    default: [1000],
    step: 100,
    desc: "滑动持续时间，单位毫秒。可选，默认 200 。",
  },
  endHold: {
    key: "end_hold",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    default: [200],
    step: 100,
    desc: "滑动到终点后，额外等待一定时间再抬起，单位 ms。可选，默认 0。",
  },
  onlyHover: {
    key: "only_hover",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "仅鼠标悬停移动，无按下/抬起动作。可选，默认 false。",
  },
  dx: {
    key: "dx",
    type: FieldTypeEnum.Int,
    default: 0,
    desc: "水平滚动距离，正值向右滚动，负值向左滚动。可选，默认 0 。",
  },
  dy: {
    key: "dy",
    type: FieldTypeEnum.Int,
    default: 0,
    desc: "垂直滚动距离，正值向下滚动，负值向上滚动。可选，默认 0 。",
  },
  swipes: {
    key: "swipes",
    type: FieldTypeEnum.ObjectList,
    required: true,
    default: [{}],
    desc: "多个滑动的数组。必选。swipes: list<object,> 多个滑动的数组。必选。 数组元素顺序没有影响，只基于 starting 确定顺序。 starting: uint 滑动起始时间，单位毫秒。可选，默认 0 。 MultiSwipe 额外字段，该滑动会在本 action 中第 starting 毫秒才开始。 begin: true | string | array<int, 2> | array<int, 4> 滑动起点。可选，默认 true 。值同 swipe-end。 begin_offset: array<int, 4> 在 begin 的基础上额外移动再作为起点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。 end: true | string | array<int, 2> | array<int, 4> | list<true | string | array<int, 2> | array<int, 4>> 滑动终点。可选，默认 true 。值同 swipe-end。 💡 v4.5.x 版本新增支持 list，可用于添加滑动途径点！相较多次 swipe 的区别是多个 end 之间不会抬手，即一次折线滑动。 end_offset: array<int, 4> | list<array<int, 4>> 在 end 的基础上额外移动再作为终点，四个值分别相加。可选，默认 [0, 0, 0, 0] 。 duration: uint | list<uint,> 滑动持续时间，单位毫秒。可选，默认 200 。 end_hold: uint | list<uint,> 滑动到终点后，额外等待一定时间再抬起，单位 ms。可选，默认 0。 only_hover: bool 仅鼠标悬停移动，无按下/抬起动作。可选，默认 false。 contact: uint 触点编号，用于区分不同的触控点。可选，默认 0 。 Adb 控制器：表示手指编号（0 为第一根手指，1 为第二根手指，以此类推） Win32 控制器：表示鼠标按键编号（0 为左键，1 为右键，2 为中键，3 为 XBUTTON1，4 为 XBUTTON2） 注意：在 MultiSwipe 中，如果 contact 为 0，将使用该滑动在数组中的索引作为触点编号。",
  },

  // 触控相关
  contact: {
    key: "contact",
    type: FieldTypeEnum.Int,
    default: [1],
    step: 1,
    desc: "触点编号，用于区分不同的触控点。可选，默认 0 。Adb 控制器：表示手指编号（0 为第一根手指，1 为第二根手指，以此类推） Win32 控制器：表示鼠标按键编号（0 为左键，1 为右键，2 为中键，3 为 XBUTTON1，4 为 XBUTTON2）",
  },
  touchTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "触控目标的位置。可选，默认 true。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
  pressure: {
    key: "pressure",
    type: FieldTypeEnum.Int,
    default: [1],
    step: 1,
    desc: "触控压力，范围取决于控制器实现。可选，默认 0 。",
  },

  // 按键相关
  clickKey: {
    key: "key",
    type: [FieldTypeEnum.IntList, FieldTypeEnum.Int],
    required: true,
    default: [1],
    step: 1,
    desc: "要单击的键，仅支持对应控制器的虚拟按键码。必选。",
  },
  longPressKey: {
    key: "key",
    type: FieldTypeEnum.Int,
    required: true,
    default: 1,
    desc: "要按下或松开的键，仅支持对应控制器的虚拟按键码。必选。",
  },
  longPressKeyDuration: {
    key: "duration",
    type: FieldTypeEnum.Int,
    default: 1000,
    step: 100,
    desc: "要按的键，仅支持对应控制器的虚拟按键码。必选。",
  },

  // 输入相关
  inputText: {
    key: "input_text",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "要输入的文本，部分控制器仅支持 ascii 。必选。",
  },

  // 应用相关
  package: {
    key: "package",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "启动入口。必选。需要填入 package name 或 activity ，例如 com.hypergryph.arknights 或 com.hypergryph.arknights/com.u8.sdk.U8UnityContext 。",
  },

  // 命令相关
  exec: {
    key: "exec",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "执行的程序路径。必选。",
  },
  commandArgs: {
    key: "args",
    type: [FieldTypeEnum.StringList, FieldTypeEnum.String],
    default: "",
    desc: "执行的参数。可选。 支持部分运行期参数替换： {ENTRY}: 任务入口名。 {NODE}: 当前节点名。 {IMAGE}: 截图保存到文件的路径。该文件在进程退出前删除，若要持久保存请自行复制。 {BOX}: 识别命中的目标，格式为 [x, y, w, h]。 {RESOURCE_DIR}: 最后一次加载的资源文件夹路径。 {LIBRARY_DIR}: MaaFW 库所在的文件夹路径。",
  },
  detach: {
    key: "detach",
    type: FieldTypeEnum.Bool,
    default: true,
    desc: "分离子进程，即不等待子进程执行完成，直接继续执行后面的任务。可选，默认 false。",
  },

  // 自定义动作相关
  customAction: {
    key: "custom_action",
    type: FieldTypeEnum.String,
    required: true,
    default: "",
    desc: "动作名，同注册接口传入的识别器名。同时会通过 MaaCustomActionCallback.custom_action_name 传出。必选。",
  },
  customActionParam: {
    key: "custom_action_param",
    type: FieldTypeEnum.Any,
    default: {},
    desc: "动作参数，任意类型，会通过 MaaCustomActionCallback.custom_action_param 传出。可选，默认空 json，即 {} 。",
  },
  customTarget: {
    key: "target",
    type: [
      FieldTypeEnum.XYWH,
      FieldTypeEnum.IntPair,
      FieldTypeEnum.True,
      FieldTypeEnum.String,
    ],
    default: [0, 0, 0, 0],
    desc: "目标的位置，会通过 MaaCustomActionCallback.box 传出。可选，默认 true 。true: 目标为本节点中刚刚识别到的位置（即自身）。string: 填写节点名，目标为之前执行过的某节点识别到的位置。array<int, 2>: 固定坐标点 [x, y]。array<int, 4>: 固定坐标区域 [x, y, w, h]，会在矩形内随机选取一点（越靠近中心概率越高，边概率相对较低），若希望全屏可设为 [0, 0, 0, 0] 。",
  },
};

/**
 * 动作字段 Schema 键列表
 */
export const actionFieldSchemaKeyList = Array.from(
  new Set(Object.values(actionFieldSchema).map((field) => field.key))
);
