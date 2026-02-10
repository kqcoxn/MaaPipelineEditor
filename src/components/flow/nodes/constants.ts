/**节点源句柄类型枚举 */
export enum SourceHandleTypeEnum {
  Next = "next",
  Error = "on_error",
}

/**节点目标句柄类型枚举 */
export enum TargetHandleTypeEnum {
  Target = "target",
  JumpBack = "jump_back",
}

/**节点类型枚举 */
export enum NodeTypeEnum {
  Pipeline = "pipeline",
  External = "external",
  Anchor = "anchor",
  Sticker = "sticker",
  Group = "group",
}

/**节点端点位置类型
 * - left-right: 左入右出（默认）
 * - right-left: 右入左出
 * - top-bottom: 上入下出
 * - bottom-top: 下入上出
 */
export type HandleDirection =
  | "left-right"
  | "right-left"
  | "top-bottom"
  | "bottom-top";

/**默认节点端点位置 */
export const DEFAULT_HANDLE_DIRECTION: HandleDirection = "left-right";

/**节点端点位置选项 */
export const HANDLE_DIRECTION_OPTIONS: {
  value: HandleDirection;
  label: string;
}[] = [
  { value: "left-right", label: "左右" },
  { value: "right-left", label: "右左" },
  { value: "top-bottom", label: "上下" },
  { value: "bottom-top", label: "下上" },
];
