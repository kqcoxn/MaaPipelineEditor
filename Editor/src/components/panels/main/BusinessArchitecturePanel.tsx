import { memo, useCallback, useMemo } from "react";
import { App as AntdApp, Modal, Tag } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useShallow } from "zustand/shallow";

import { useBusinessArchitectureStore } from "@/features/ai-harness";
import { buildBusinessArchitectureSourceSignature } from "@/features/ai-harness/capabilities/business-architecture/architectureModel";
import {
  buildBusinessArchitectureGraph,
  type BusinessStageNode,
} from "@/features/ai-harness/capabilities/business-architecture/architectureGraph";
import { BusinessStageNodeComponent } from "@/features/ai-harness/capabilities/business-architecture/BusinessStageNode";
import { useFlowStore } from "@/stores/flow";
import { useFileStore } from "@/stores/project/fileStore";
import { selectAndFitNodeIds } from "@/services/flowNavigationService";
import style from "@/styles/panels/BusinessArchitecturePanel.module.less";

const nodeTypes = { businessStage: BusinessStageNodeComponent };

function BusinessArchitecturePanel() {
  const activeDocumentRunId = useBusinessArchitectureStore(
    (state) => state.activeDocumentRunId,
  );
  if (!activeDocumentRunId) return null;
  return <BusinessArchitecturePanelContent />;
}

function BusinessArchitecturePanelContent() {
  const { message } = AntdApp.useApp();
  const documents = useBusinessArchitectureStore((state) => state.documents);
  const activeDocumentRunId = useBusinessArchitectureStore(
    (state) => state.activeDocumentRunId,
  );
  const closeDocument = useBusinessArchitectureStore(
    (state) => state.closeDocument,
  );
  const { semanticRevision, topologyRevision } = useFlowStore(
    useShallow((state) => ({
      semanticRevision: state.semanticRevision,
      topologyRevision: state.topologyRevision,
    })),
  );
  const currentFile = useFileStore((state) => state.currentFile);
  const document = activeDocumentRunId
    ? documents[activeDocumentRunId]
    : undefined;
  const isCurrentFile = document?.fileName === currentFile.fileName;
  const currentSignature = useMemo(
    () => {
      if (!document || !isCurrentFile) return "";
      void semanticRevision;
      void topologyRevision;
      const { nodes, edges } = useFlowStore.getState();
      return buildBusinessArchitectureSourceSignature({
        nodes,
        edges,
        selectedNodeIds: [],
        targetNodeId: null,
        fileName: currentFile.fileName,
        prefix: currentFile.config.prefix,
      });
    },
    [
      currentFile.config.prefix,
      currentFile.fileName,
      document,
      isCurrentFile,
      semanticRevision,
      topologyRevision,
    ],
  );
  const stale = Boolean(
    document && isCurrentFile && document.sourceSignature !== currentSignature,
  );
  const graph = useMemo(
    () =>
      document
        ? buildBusinessArchitectureGraph(document)
        : { nodes: [], edges: [] },
    [document],
  );

  const handleStageClick = useCallback<NodeMouseHandler<BusinessStageNode>>(
    (_event, stageNode) => {
      if (!isCurrentFile) {
        message.warning("该架构产物不属于当前文件，无法定位节点");
        return;
      }
      const memberIds = new Set(stageNode.data.stage.nodeIds);
      const focusNodes = selectAndFitNodeIds([...memberIds], {
        delay: 120,
        duration: 500,
        padding: 0.3,
        maxZoom: 1.35,
      });
      if (focusNodes.length === 0) {
        message.warning("该阶段的节点已不在当前画布中");
        return;
      }
      closeDocument();
    },
    [closeDocument, isCurrentFile, message],
  );

  return (
    <Modal
      open={Boolean(document)}
      onCancel={closeDocument}
      footer={null}
      width="min(1200px, calc(100vw - 32px))"
      centered
      destroyOnHidden
      classNames={{
        header: style.modalHeader,
        body: style.modalBody,
        content: style.modalContent,
      }}
      title={
        <div className={style.modalTitle}>
          <ApartmentOutlined />
          <span>流程架构</span>
          <Tag color="cyan" variant="filled" className={style.aiTag}>
            AI
          </Tag>
        </div>
      }
    >
      {document && (
        <div className={style.content}>
          <section className={style.summaryBand}>
            <div className={style.summaryCopy}>
              <h2>{document.title}</h2>
              <p>{document.summary}</p>
            </div>
            <div className={style.summaryMeta}>
              {!isCurrentFile && <Tag color="warning">非当前文件</Tag>}
              {stale && <Tag color="warning">画布已变化</Tag>}
              <Tag>{document.stages.length} 个阶段</Tag>
              <Tag>{document.coverage.includedNodeCount} 个节点</Tag>
            </div>
          </section>
          <div className={style.graph}>
            <ReactFlow<BusinessStageNode>
              key={document.sourceRunId}
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              onNodeClick={handleStageClick}
              fitView
              fitViewOptions={{ padding: 0.22, maxZoom: 1.15 }}
              minZoom={0.25}
              maxZoom={1.8}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnScroll
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1}
                color="var(--ant-color-border-secondary)"
              />
              <Controls showInteractive={false} orientation="vertical" />
            </ReactFlow>
          </div>
          <footer className={style.legend} aria-label="流程关系图例">
            <span>
              <i className={style.legendNext} />候选流转
            </span>
            <span>
              <i className={style.legendError} />异常恢复
            </span>
            <span>
              <i className={style.legendJump} />执行后回跳
            </span>
          </footer>
        </div>
      )}
    </Modal>
  );
}

export default memo(BusinessArchitecturePanel);
