/**节点源句柄类型枚举 */
export enum SourceHandleTypeEnum {
  Next = "next",
  JumpBack = "jump_back",
  Error = "on_error",
}

/**节点类型枚举 */
export enum NodeTypeEnum {
  Pipeline = "pipeline",
  External = "external",
  Anchor = "anchor",
}
