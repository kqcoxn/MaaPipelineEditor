import type { FieldsType } from "../types";
import { actionFieldSchema } from "./schema";

/**
 * 动作字段配置
 */
export const actionFields: Record<string, FieldsType> = {
  DoNothing: {
    params: [],
    desc: "什么都不做。",
  },
  Click: {
    params: [actionFieldSchema.clickTarget, actionFieldSchema.targetOffset],
    desc: "点击。",
  },
  Custom: {
    params: [
      actionFieldSchema.customAction,
      actionFieldSchema.customActionParam,
      actionFieldSchema.customTarget,
      actionFieldSchema.targetOffset,
    ],
    desc: "执行通过 MaaResourceRegisterCustomAction 接口传入的动作句柄。",
  },
  Swipe: {
    params: [
      actionFieldSchema.begin,
      actionFieldSchema.beginOffset,
      actionFieldSchema.end,
      actionFieldSchema.endOffset,
      actionFieldSchema.swipeDuration,
      actionFieldSchema.endHold,
      actionFieldSchema.onlyHover,
    ],
    desc: "线性滑动。",
  },
  Scroll: {
    params: [actionFieldSchema.scrollTarget, actionFieldSchema.scrollTargetOffset, actionFieldSchema.dx, actionFieldSchema.dy],
    desc: "鼠标滚轮滚动。Adb 控制器和 PlayCover 控制器不支持滚动操作。仅 Win32 控制器支持。 dx/dy 的值会直接作为滚动增量发送。Windows 标准滚轮每格增量为 120（WHEEL_DELTA），建议使用 120 的整数倍以获得最佳兼容性。",
  },
  ClickKey: {
    params: [actionFieldSchema.clickKey],
    desc: "单击按键。",
  },
  LongPress: {
    params: [
      actionFieldSchema.longPressTarget,
      actionFieldSchema.targetOffset,
      actionFieldSchema.longPressDuration,
    ],
    desc: "长按。",
  },
  MultiSwipe: {
    params: [actionFieldSchema.swipes],
    desc: "多指线性滑动。",
  },
  TouchDown: {
    params: [
      actionFieldSchema.contact,
      actionFieldSchema.touchTarget,
      actionFieldSchema.targetOffset,
      actionFieldSchema.pressure,
    ],
    desc: "按下触控点。",
  },
  TouchMove: {
    params: [
      actionFieldSchema.contact,
      actionFieldSchema.touchTarget,
      actionFieldSchema.targetOffset,
      actionFieldSchema.pressure,
    ],
    desc: "移动触控点。字段含义与 TouchDown 一致，用于更新触点位置。",
  },
  TouchUp: {
    params: [actionFieldSchema.contact],
    desc: "抬起触控点。",
  },
  LongPressKey: {
    params: [
      actionFieldSchema.longPressKey,
      actionFieldSchema.longPressKeyDuration,
    ],
    desc: "长按按键。",
  },
  KeyDown: {
    params: [actionFieldSchema.longPressKey],
    desc: "按下按键但不立即松开。可与 KeyUp 配合实现自定义按键时序。",
  },
  KeyUp: {
    params: [actionFieldSchema.longPressKey],
    desc: "松开按键。用于结束 KeyDown 建立的按键状态。",
  },
  InputText: {
    params: [actionFieldSchema.inputText],
    desc: "输入文本。",
  },
  StartApp: {
    params: [actionFieldSchema.package],
    desc: "启动 App 。",
  },
  StopApp: {
    params: [actionFieldSchema.package],
    desc: "关闭 App 。",
  },
  StopTask: {
    params: [],
    desc: "停止当前任务链（MaaTaskerPostTask 传入的单个任务链）。",
  },
  Command: {
    params: [
      actionFieldSchema.exec,
      actionFieldSchema.commandArgs,
      actionFieldSchema.detach,
    ],
    desc: "执行命令。",
  },
  Shell: {
    params: [
      actionFieldSchema.cmd,
      actionFieldSchema.timeout
    ],
    desc: "在 ADB 设备上执行 shell 命令。",
  },
  Key: {
    params: [actionFieldSchema.clickKey],
    desc: "（已在 4.5 版本中废弃，但保留兼容性，推荐使用 ClickKey 替代）按键。",
  },
};
