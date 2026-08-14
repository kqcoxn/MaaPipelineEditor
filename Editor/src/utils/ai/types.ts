/** AI 业务层共享的节点上下文类型。 */
export interface NodeContext {
  currentNode: {
    label: string;
  };
  precedingNodes: Array<{
    label: string;
    connectionType: string;
    nodeJson?: Record<string, unknown>;
  }>;
}
