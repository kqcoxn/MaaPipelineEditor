import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "@/components/flow/nodes";
import {
  convertMfwToStoreFormat,
  flowToPipeline,
} from "@/core/parser";
import {
  createAnchorNode,
  createExternalNode,
  createGroupNode,
  createPipelineNode,
  createStickerNode,
  type EdgeType,
  type NodeType,
  useFlowStore,
} from "@/stores/flow";
import { saveFlow, useFileStore } from "@/stores/project/fileStore";
import {
  normalizeCanvasEdgeLabels,
  validateCanvasGraph,
} from "./canvasGraphValidation";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types";

export type CanvasNodeKind =
  | "pipeline"
  | "external"
  | "anchor"
  | "sticker"
  | "group";

export type CanvasMutation =
  | {
      type: "create_node";
      nodeId?: string;
      name: string;
      nodeType?: CanvasNodeKind;
      pipeline?: Record<string, unknown>;
      data?: Record<string, unknown>;
      position?: { x: number; y: number };
    }
  | {
      type: "update_node";
      nodeId: string;
      name?: string;
      pipeline?: Record<string, unknown>;
      data?: Record<string, unknown>;
      position?: { x: number; y: number };
    }
  | { type: "delete_node"; nodeId: string }
  | {
      type: "create_connection";
      sourceId: string;
      targetId: string;
      sourceHandle: SourceHandleTypeEnum;
      targetHandle?: TargetHandleTypeEnum;
      attributes?: { jump_back?: boolean; anchor?: boolean };
    }
  | {
      type: "update_connection";
      connectionId: string;
      sourceId?: string;
      targetId?: string;
      sourceHandle?: SourceHandleTypeEnum;
      targetHandle?: TargetHandleTypeEnum;
      attributes?: { jump_back?: boolean; anchor?: boolean };
    }
  | { type: "delete_connection"; connectionId: string };

export interface CanvasGraphState {
  nodes: NodeType[];
  edges: EdgeType[];
  selectedNodeIds: string[];
  targetNodeId: string | null;
  fileName: string;
  prefix: string;
}

export interface CanvasCommandBusAdapter {
  read: () => CanvasGraphState;
  commit: (nodes: NodeType[], edges: EdgeType[]) => void;
}

function createDefaultAdapter(): CanvasCommandBusAdapter {
  return {
    read: () => {
      const flow = useFlowStore.getState();
      const file = useFileStore.getState().currentFile;
      return {
        nodes: flow.nodes,
        edges: flow.edges,
        selectedNodeIds: flow.selectedNodes.map((node) => node.id),
        targetNodeId: flow.targetNode?.id ?? null,
        fileName: file.fileName,
        prefix: file.config.prefix,
      };
    },
    commit: (nodes, edges) => {
      useFlowStore.getState().replace(nodes, edges, {
        isFitView: false,
        skipHistory: false,
        skipSave: true,
      });
      saveFlow();
    },
  };
}

export class CanvasCommandBus {
  private stateVersion = 1;
  private lastFingerprint = "";
  private idSequence = 0;

  constructor(
    private readonly adapter: CanvasCommandBusAdapter = createDefaultAdapter(),
  ) {}

  getStateVersion(): number {
    const graph = this.adapter.read();
    const fingerprint = JSON.stringify({ nodes: graph.nodes, edges: graph.edges });
    if (!this.lastFingerprint) {
      this.lastFingerprint = fingerprint;
    } else if (fingerprint !== this.lastFingerprint) {
      this.lastFingerprint = fingerprint;
      this.stateVersion += 1;
    }
    return this.stateVersion;
  }

  readSummary(context?: ToolExecutionContext): ToolExecutionResult {
    const graph = this.adapter.read();
    const stateVersion = this.getStateVersion();
    const scopeError = this.validateReadContext(context, graph, stateVersion);
    if (scopeError) return scopeError;
    return {
      ok: true,
      stateVersion,
      data: {
        fileName: graph.fileName,
        nodeCount: graph.nodes.length,
        connectionCount: graph.edges.length,
        stateVersion,
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          name: node.data.label,
          type: node.type,
        })),
        connections: graph.edges.map(toConnectionSummary),
      },
    };
  }

  readNode(nodeId: string, context?: ToolExecutionContext): ToolExecutionResult {
    const graph = this.adapter.read();
    const stateVersion = this.getStateVersion();
    const scopeError = this.validateReadContext(context, graph, stateVersion);
    if (scopeError) return scopeError;
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) return notFound(`节点不存在: ${nodeId}`, stateVersion);

    const pipeline = flowToPipeline({
      nodes: graph.nodes,
      edges: graph.edges,
      fileName: graph.fileName,
      config: { prefix: graph.prefix },
      forceExportConfig: false,
    });
    const fullName = graph.prefix
      ? `${graph.prefix}_${node.data.label}`
      : node.data.label;
    return {
      ok: true,
      stateVersion,
      data: {
        id: node.id,
        name: node.data.label,
        type: node.type,
        position: node.position,
        pipeline: pipeline[fullName] ?? null,
      },
    };
  }

  readSelection(context?: ToolExecutionContext): ToolExecutionResult {
    const graph = this.adapter.read();
    const stateVersion = this.getStateVersion();
    const scopeError = this.validateReadContext(context, graph, stateVersion);
    if (scopeError) return scopeError;
    return {
      ok: true,
      stateVersion,
      data: {
        selectedNodeIds: graph.selectedNodeIds,
        targetNodeId: graph.targetNodeId,
      },
    };
  }

  validateCanvas(context?: ToolExecutionContext): ToolExecutionResult {
    const graph = this.adapter.read();
    const stateVersion = this.getStateVersion();
    const scopeError = this.validateReadContext(context, graph, stateVersion);
    if (scopeError) return scopeError;
    const errors = validateCanvasGraph(graph.nodes, graph.edges);
    return {
      ok: errors.length === 0,
      stateVersion,
      data: { valid: errors.length === 0 },
      validationErrors: errors,
      error:
        errors.length > 0
          ? {
              code: "non_retryable",
              message: "画布校验失败",
              retryable: false,
              details: errors,
            }
          : undefined,
    };
  }

  private validateReadContext(
    context: ToolExecutionContext | undefined,
    graph: CanvasGraphState,
    stateVersion: number,
  ): ToolExecutionResult | undefined {
    if (!context) return undefined;
    if (context.signal.aborted) {
      return commandError("non_retryable", "Run 已取消", stateVersion);
    }
    if (context.fileName !== graph.fileName) {
      return commandError(
        "permission_denied",
        "工具只能读取 Run 创建时的当前文件",
        stateVersion,
      );
    }
    return undefined;
  }

  apply(
    context: ToolExecutionContext,
    mutations: CanvasMutation[],
  ): ToolExecutionResult {
    const graph = this.adapter.read();
    const currentVersion = this.getStateVersion();
    if (context.signal.aborted) {
      return commandError("non_retryable", "Run 已取消", currentVersion);
    }
    if (context.fileName !== graph.fileName) {
      return commandError("permission_denied", "工具只能操作 Run 创建时的当前文件", currentVersion);
    }
    if (context.expectedStateVersion !== currentVersion) {
      return commandError(
        "state_conflict",
        `画布状态已变化，期望版本 ${context.expectedStateVersion}，当前版本 ${currentVersion}`,
        currentVersion,
      );
    }
    if (mutations.length === 0) {
      return commandError("invalid_arguments", "批量变更不能为空", currentVersion);
    }

    let nodes = structuredClone(graph.nodes);
    let edges = structuredClone(graph.edges);
    const changes: string[] = [];
    try {
      for (const mutation of mutations) {
        ({ nodes, edges } = this.applyMutation(nodes, edges, mutation, changes));
      }
    } catch (error) {
      return commandError(
        "non_retryable",
        error instanceof Error ? error.message : String(error),
        currentVersion,
      );
    }

    const validationErrors = validateCanvasGraph(nodes, edges);
    if (validationErrors.length > 0) {
      return {
        ...commandError(
          "non_retryable",
          "变更后的画布未通过校验",
          currentVersion,
        ),
        validationErrors,
      };
    }

    this.adapter.commit(nodes, edges);
    const stateVersion = this.getStateVersion();
    return {
      ok: true,
      data: { applied: mutations.length },
      stateVersion,
      changes,
      validationErrors: [],
      undoable: true,
    };
  }

  private applyMutation(
    nodes: NodeType[],
    edges: EdgeType[],
    mutation: CanvasMutation,
    changes: string[],
  ): { nodes: NodeType[]; edges: EdgeType[] } {
    switch (mutation.type) {
      case "create_node": {
        const node = this.createNode(mutation, nodes);
        changes.push(`创建节点 ${node.data.label}`);
        return { nodes: [...nodes, node], edges };
      }
      case "update_node": {
        const index = nodes.findIndex((node) => node.id === mutation.nodeId);
        if (index < 0) throw new Error(`节点不存在: ${mutation.nodeId}`);
        const original = nodes[index];
        const data = mutation.pipeline
          ? convertMfwToStoreFormat(
              {
                ...mutation.pipeline,
                label: mutation.name ?? original.data.label,
              },
              original,
            )
          : {
              ...original.data,
              ...mutation.data,
              ...(mutation.name ? { label: mutation.name } : {}),
            };
        const updated = {
          ...original,
          data,
          position: mutation.position ?? original.position,
        } as NodeType;
        const nextNodes = [...nodes];
        nextNodes[index] = updated;
        changes.push(`修改节点 ${original.data.label}`);
        return { nodes: nextNodes, edges };
      }
      case "delete_node": {
        const node = nodes.find((item) => item.id === mutation.nodeId);
        if (!node) throw new Error(`节点不存在: ${mutation.nodeId}`);
        changes.push(`删除节点 ${node.data.label}`);
        return {
          nodes: nodes.filter((item) => item.id !== mutation.nodeId),
          edges: edges.filter(
            (edge) =>
              edge.source !== mutation.nodeId && edge.target !== mutation.nodeId,
          ),
        };
      }
      case "create_connection": {
        const edge: EdgeType = {
          id: this.nextId("ai_edge"),
          source: mutation.sourceId,
          target: mutation.targetId,
          sourceHandle: mutation.sourceHandle,
          targetHandle: mutation.targetHandle ?? TargetHandleTypeEnum.Target,
          type: "marked",
          label:
            edges.filter(
              (item) =>
                item.source === mutation.sourceId &&
                item.sourceHandle === mutation.sourceHandle,
            ).length + 1,
          attributes: mutation.attributes,
        };
        changes.push(`创建连接 ${edge.source} -> ${edge.target}`);
        return { nodes, edges: [...edges, edge] };
      }
      case "update_connection": {
        const index = edges.findIndex((edge) => edge.id === mutation.connectionId);
        if (index < 0) throw new Error(`连接不存在: ${mutation.connectionId}`);
        const current = edges[index];
        const updated: EdgeType = {
          ...current,
          source: mutation.sourceId ?? current.source,
          target: mutation.targetId ?? current.target,
          sourceHandle: mutation.sourceHandle ?? current.sourceHandle,
          targetHandle: mutation.targetHandle ?? current.targetHandle,
          attributes: mutation.attributes ?? current.attributes,
        };
        const nextEdges = [...edges];
        nextEdges[index] = updated;
        changes.push(`修改连接 ${current.id}`);
        return { nodes, edges: normalizeCanvasEdgeLabels(nextEdges) };
      }
      case "delete_connection": {
        const edge = edges.find((item) => item.id === mutation.connectionId);
        if (!edge) throw new Error(`连接不存在: ${mutation.connectionId}`);
        changes.push(`删除连接 ${edge.id}`);
        return {
          nodes,
          edges: normalizeCanvasEdgeLabels(
            edges.filter((item) => item.id !== mutation.connectionId),
          ),
        };
      }
    }
  }

  private createNode(
    mutation: Extract<CanvasMutation, { type: "create_node" }>,
    nodes: NodeType[],
  ): NodeType {
    const id = mutation.nodeId ?? this.nextId("ai_node");
    const position =
      mutation.position ?? {
        x: Math.max(0, ...nodes.map((node) => node.position.x)) + 260,
        y: 80,
      };
    const nodeType = mutation.nodeType ?? "pipeline";
    if (nodeType === "pipeline") {
      const node = createPipelineNode(id, { label: mutation.name, position });
      node.data = convertMfwToStoreFormat(
        { ...mutation.pipeline, label: mutation.name },
        node,
      );
      return node;
    }
    if (nodeType === "external") {
      return createExternalNode(id, { label: mutation.name, position, datas: mutation.data });
    }
    if (nodeType === "anchor") {
      return createAnchorNode(id, { label: mutation.name, position, datas: mutation.data });
    }
    if (nodeType === "sticker") {
      return createStickerNode(id, {
        label: mutation.name,
        position,
        datas: mutation.data as { content?: string; color?: "yellow" | "green" | "blue" | "pink" | "purple" },
      });
    }
    return createGroupNode(id, {
      label: mutation.name,
      position,
      datas: mutation.data as { color?: "blue" | "green" | "purple" | "orange" | "gray" },
    });
  }

  private nextId(prefix: string): string {
    this.idSequence += 1;
    return `${prefix}_${Date.now()}_${this.idSequence}`;
  }
}

function toConnectionSummary(edge: EdgeType) {
  return {
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    order: edge.label,
    attributes: edge.attributes,
  };
}

function notFound(message: string, stateVersion: number): ToolExecutionResult {
  return commandError("non_retryable", message, stateVersion);
}

function commandError(
  code: "invalid_arguments" | "permission_denied" | "state_conflict" | "retryable" | "non_retryable",
  message: string,
  stateVersion: number,
): ToolExecutionResult {
  return {
    ok: false,
    stateVersion,
    error: {
      code,
      message,
      retryable: code === "retryable" || code === "state_conflict",
    },
  };
}

export const canvasCommandBus = new CanvasCommandBus();
