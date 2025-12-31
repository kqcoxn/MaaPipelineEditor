import style from "../../styles/FieldPanel.module.less";

import {
  useMemo,
  memo,
  useCallback,
  useState,
  Component,
  type ReactNode,
  useEffect,
} from "react";
import { Tooltip, Spin, Alert, Button, Tabs } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import {
  useFlowStore,
  type PipelineNodeType,
  type ExternalNodeType,
  type AnchorNodeType,
  type NodeType,
} from "../../stores/flow";
import { NodeTypeEnum } from "../flow/nodes";
import {
  PipelineEditorWithSuspense,
  ExternalEditor,
  AnchorEditor,
} from "./node-editors";
import { FieldPanelToolbarLeft, FieldPanelToolbarRight } from "./field-tools";
import { useDebugStore } from "../../stores/debugStore";
import { useToolbarStore } from "../../stores/toolbarStore";
import DebugInfoTab from "./DebugInfoTab";

// 节点数据验证与修复
function validateAndRepairNode(node: NodeType): {
  valid: boolean;
  error?: string;
  repaired?: NodeType;
} {
  if (!node) {
    return { valid: false, error: "节点数据为空" };
  }

  if (!node.type) {
    return { valid: false, error: "节点类型缺失" };
  }

  if (!node.data) {
    return { valid: false, error: "节点数据结构损坏" };
  }

  // 验证 Pipeline 节点
  if (node.type === NodeTypeEnum.Pipeline) {
    const pipelineNode = node as PipelineNodeType;
    let needsRepair = false;
    const repairedData = { ...pipelineNode.data };

    // 检查并修复 recognition
    if (
      !repairedData.recognition ||
      typeof repairedData.recognition !== "object"
    ) {
      needsRepair = true;
      repairedData.recognition = { type: "DirectHit", param: {} };
    } else {
      if (!repairedData.recognition.type) {
        needsRepair = true;
        repairedData.recognition.type = "DirectHit";
      }
      if (
        !repairedData.recognition.param ||
        typeof repairedData.recognition.param !== "object"
      ) {
        needsRepair = true;
        repairedData.recognition.param = {};
      }
    }

    // 检查并修复 action
    if (!repairedData.action || typeof repairedData.action !== "object") {
      needsRepair = true;
      repairedData.action = { type: "DoNothing", param: {} };
    } else {
      if (!repairedData.action.type) {
        needsRepair = true;
        repairedData.action.type = "DoNothing";
      }
      if (
        !repairedData.action.param ||
        typeof repairedData.action.param !== "object"
      ) {
        needsRepair = true;
        repairedData.action.param = {};
      }
    }

    // 检查并修复 others
    if (!repairedData.others || typeof repairedData.others !== "object") {
      needsRepair = true;
      repairedData.others = {};
    }

    if (needsRepair) {
      return {
        valid: true,
        error: "节点数据结构不完整，已自动修复",
        repaired: { ...pipelineNode, data: repairedData } as NodeType,
      };
    }
  }

  return { valid: true };
}

// 错误边界组件
class EditorErrorBoundary extends Component<
  {
    children: ReactNode;
    nodeName: string;
    nodeType: string;
    onRepair?: () => void;
  },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("节点编辑器渲染错误:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <Alert
            message="节点编辑器渲染失败"
            description={
              <div>
                <p>节点名称: {this.props.nodeName}</p>
                <p>节点类型: {this.props.nodeType}</p>
                <p>错误信息: {this.state.error?.message}</p>
                <p style={{ marginTop: 10, color: "#666" }}>
                  可能原因：节点数据结构损坏或缺少必要字段
                </p>
                {this.props.onRepair && (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      this.setState({ hasError: false, error: undefined });
                      this.props.onRepair?.();
                    }}
                    style={{ marginTop: 10 }}
                  >
                    尝试修复节点
                  </Button>
                )}
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// 面板
function FieldPanel() {
  const currentNode = useFlowStore((state) => state.targetNode);
  const updateNodes = useFlowStore((state) => state.updateNodes);
  const debugMode = useDebugStore((state) => state.debugMode);
  const setCurrentRightPanel = useToolbarStore(
    (state) => state.setCurrentRightPanel
  );
  const [isLoading, setIsLoading] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [progressDetail, setProgressDetail] = useState("");
  const [validationWarning, setValidationWarning] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("fields");

  // 当面板打开时通知 toolbarStore
  useEffect(() => {
    if (currentNode) {
      setCurrentRightPanel("field");
    }
  }, [currentNode, setCurrentRightPanel]);

  // 验证并修复节点数据
  const handleNodeRepair = useCallback(() => {
    if (!currentNode) return;

    const validation = validateAndRepairNode(currentNode);
    if (validation.repaired) {
      // 更新节点数据
      updateNodes([
        { type: "replace", id: currentNode.id, item: validation.repaired },
      ]);
      setValidationWarning(null);
    }
  }, [currentNode, updateNodes]);

  // 验证当前节点
  const nodeValidation = useMemo(() => {
    if (!currentNode) return { valid: true };
    const validation = validateAndRepairNode(currentNode);

    // 节点有问题时警告
    if (validation.error && validation.repaired) {
      setValidationWarning(validation.error);
    } else {
      setValidationWarning(null);
    }

    return validation;
  }, [currentNode]);

  // 内容
  const renderContent = useMemo(() => {
    if (!currentNode) return null;

    // 无法修复
    if (!nodeValidation.valid) {
      return (
        <div style={{ padding: 20 }}>
          <Alert
            message="节点数据损坏"
            description={
              <div>
                <p>节点名称: {currentNode.data?.label || "未知"}</p>
                <p>节点类型: {currentNode.type || "未知"}</p>
                <p>错误: {nodeValidation.error}</p>
                <p style={{ marginTop: 10, color: "#666" }}>
                  建议删除此节点并重新创建
                </p>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      );
    }

    // 使用修复后的节点或原节点
    const nodeToRender = nodeValidation.repaired || currentNode;

    const content = (() => {
      switch (nodeToRender.type) {
        case NodeTypeEnum.Pipeline:
          return (
            <EditorErrorBoundary
              nodeName={nodeToRender.data?.label || "未知"}
              nodeType="Pipeline"
              onRepair={handleNodeRepair}
            >
              <PipelineEditorWithSuspense
                currentNode={nodeToRender as PipelineNodeType}
              />
            </EditorErrorBoundary>
          );
        case NodeTypeEnum.External:
          return (
            <EditorErrorBoundary
              nodeName={nodeToRender.data?.label || "未知"}
              nodeType="External"
              onRepair={handleNodeRepair}
            >
              <ExternalEditor currentNode={nodeToRender as ExternalNodeType} />
            </EditorErrorBoundary>
          );
        case NodeTypeEnum.Anchor:
          return (
            <EditorErrorBoundary
              nodeName={nodeToRender.data?.label || "未知"}
              nodeType="Anchor"
              onRepair={handleNodeRepair}
            >
              <AnchorEditor currentNode={nodeToRender as AnchorNodeType} />
            </EditorErrorBoundary>
          );
        default:
          return (
            <div style={{ padding: 20 }}>
              <Alert
                message="未知节点类型"
                description={`节点类型 "${nodeToRender.type}" 不受支持`}
                type="warning"
                showIcon
              />
            </div>
          );
      }
    })();

    // 添加遮罩层
    if (isLoading) {
      return (
        <div style={{ position: "relative" }}>
          {content}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(255, 255, 255, 0.9)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <Spin size="large" />
            <div
              style={{
                marginTop: 16,
                fontSize: 16,
                fontWeight: 500,
                color: "#1890ff",
              }}
            >
              {progressStage}
            </div>
            {progressDetail && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "#666",
                }}
              >
                {progressDetail}
              </div>
            )}
          </div>
        </div>
      );
    }

    return content;
  }, [
    currentNode,
    isLoading,
    progressStage,
    progressDetail,
    nodeValidation,
    handleNodeRepair,
  ]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": currentNode !== null,
      }),
    [currentNode]
  );

  // 删除节点
  const handleDelete = useCallback(() => {
    if (currentNode) {
      const updateNodes = useFlowStore.getState().updateNodes;
      updateNodes([{ type: "remove", id: currentNode.id }]);
    }
  }, [currentNode]);

  // 进度变化回调
  const handleProgressChange = useCallback((stage: string, detail?: string) => {
    setProgressStage(stage);
    setProgressDetail(detail || "");
  }, []);

  // 渲染
  return (
    <div className={panelClass}>
      <div className="header">
        <div className="header-left">
          <FieldPanelToolbarLeft currentNode={currentNode} />
        </div>
        <div className="header-center">
          <div className="title">节点字段</div>
        </div>
        <div className="header-right">
          <FieldPanelToolbarRight
            currentNode={currentNode}
            onLoadingChange={setIsLoading}
            onProgressChange={handleProgressChange}
            onDelete={handleDelete}
          />
        </div>
      </div>
      {/* 数据验证警告 */}
      {validationWarning && (
        <div style={{ padding: "8px 12px" }}>
          <Alert
            message={validationWarning}
            type="warning"
            showIcon
            closable
            onClose={() => setValidationWarning(null)}
            action={
              <Button size="small" type="primary" onClick={handleNodeRepair}>
                应用修复
              </Button>
            }
          />
        </div>
      )}
      {/* 标签页 */}
      {debugMode && currentNode ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="small"
          items={[
            {
              key: "fields",
              label: "字段配置",
              children: renderContent,
            },
            {
              key: "debug",
              label: "调试信息",
              children: <DebugInfoTab />,
            },
          ]}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          tabBarStyle={{ margin: 0, paddingLeft: 12, paddingRight: 12 }}
        />
      ) : (
        renderContent
      )}
    </div>
  );
}

export default memo(FieldPanel);
