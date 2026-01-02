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
}
