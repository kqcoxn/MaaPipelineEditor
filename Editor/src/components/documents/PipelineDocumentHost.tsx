import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Alert, Button, Dropdown, Segmented, Space, Tag, Tooltip } from "antd";
import {
  CodeOutlined,
  EyeOutlined,
  SaveOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { BeforeMount, Monaco, OnMount } from "@monaco-editor/react";

import style from "../../styles/documents/PipelineDocumentHost.module.less";
import { MfwJsonEditor } from "../json/MfwJsonEditor";
import { useDocumentStore } from "../../stores/documentStore";
import { usePipelineDocumentStore } from "../../features/pipeline-document/pipelineDocumentStore";
import {
  setPipelineViewMode,
  updatePipelineWorkingText,
} from "../../features/pipeline-document/pipelineDocumentService";
import {
  registerPipelineEditor,
  revealPipelineDiagnostic,
  updatePipelineMarkers,
} from "../../features/pipeline-document/pipelineMonacoModels";
import type { PipelineViewMode } from "../../features/pipeline-document/types";
import type { DocumentId } from "../../features/project-session/types";
import { saveActiveEditor } from "../../services/editorCommands";
import { ExportFileModal } from "../modals/ExportFileModal";
import { useToolbarStore } from "../../stores/toolbarStore";
import type { DocumentDiagnostic } from "../../stores/documentStore";

interface PipelineDocumentHostProps {
  documentId: DocumentId;
  canvas: React.ReactNode;
}

const configureJson: BeforeMount = (monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: false,
    allowComments: true,
    enableSchemaRequest: false,
  });
};

const sourceOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 14,
  lineHeight: 22,
  letterSpacing: 0,
  scrollBeyondLastLine: false,
  smoothScrolling: false,
  padding: { top: 14, bottom: 14 },
  renderWhitespace: "selection" as const,
  wordWrap: "on" as const,
};
const emptyDiagnostics: DocumentDiagnostic[] = [];

export const PipelineDocumentHost = memo(
  ({ documentId, canvas }: PipelineDocumentHostProps) => {
    const document = useDocumentStore((state) => state.opened[documentId]);
    const pipelineState = usePipelineDocumentStore(
      (state) => state.documents[documentId],
    );
    const monacoRef = useRef<Monaco | null>(null);
    const exportDialogOpen = useToolbarStore((state) => state.exportDialogOpen);
    const closeExportDialog = useToolbarStore((state) => state.closeExportDialog);
    const diagnostics = document?.diagnostics ?? emptyDiagnostics;
    const firstError = diagnostics.find((item) => item.severity === "error");
    const viewMode = pipelineState?.viewMode ?? "flow";
    const parseInvalid = pipelineState?.parseState === "invalid";
    const projectionStatus = pipelineState?.projectionStatus ?? "unavailable";
    const projectionStatusLabel =
      projectionStatus === "ready"
        ? "已同步"
        : projectionStatus === "partial"
          ? "部分投影"
          : "源码有误";

    useEffect(() => {
      if (monacoRef.current) {
        updatePipelineMarkers(monacoRef.current, documentId, diagnostics);
      }
    }, [diagnostics, documentId]);

    const focusDiagnostic = useCallback(
      (diagnostic: DocumentDiagnostic) => {
        setPipelineViewMode(documentId, "source");
        requestAnimationFrame(() => revealPipelineDiagnostic(documentId, diagnostic));
      },
      [documentId],
    );
    const focusFirstError = useCallback(() => {
      if (firstError) focusDiagnostic(firstError);
    }, [firstError, focusDiagnostic]);
    const diagnosticItems = useMemo(
      () =>
        diagnostics.map((diagnostic, index) => ({
          key: String(index),
          label: diagnostic.message,
          danger: diagnostic.severity === "error",
          onClick: () => focusDiagnostic(diagnostic),
        })),
      [diagnostics, focusDiagnostic],
    );

    const changeView = useCallback(
      (value: string | number) => {
        const nextMode = value as PipelineViewMode;
        if (!setPipelineViewMode(documentId, nextMode)) focusFirstError();
      },
      [documentId, focusFirstError],
    );

    const mountEditor: OnMount = useCallback(
      (editor, monaco) => {
        monacoRef.current = monaco;
        registerPipelineEditor(documentId, editor);
        updatePipelineMarkers(monaco, documentId, diagnostics);
        if (parseInvalid) focusFirstError();
      },
      [diagnostics, documentId, focusFirstError, parseInvalid],
    );

    if (!document) return null;

    return (
      <section className={style.host} aria-label={`Pipeline 文档 ${document.descriptor.name}`}>
        <header className={style.toolbar}>
          <div className={style.identity}>
            <span className={style.name}>{document.descriptor.name}</span>
            <span className={style.path}>{document.path || "未保存草稿"}</span>
            {document.dirty && <span className={style.dirtyDot} aria-label="未保存" />}
          </div>
          <Space size="small">
            <Tag
              color={
                projectionStatus === "ready"
                  ? "success"
                  : projectionStatus === "partial"
                    ? "warning"
                    : "error"
              }
            >
              {projectionStatusLabel}
            </Tag>
            {diagnostics.length > 0 && (
              <Dropdown menu={{ items: diagnosticItems }} trigger={["click"]}>
                <Button
                  type="text"
                  size="small"
                  danger={Boolean(firstError)}
                  icon={<WarningOutlined />}
                  aria-label={`查看 ${diagnostics.length} 条诊断`}
                >
                  {diagnostics.length}
                </Button>
              </Dropdown>
            )}
            {viewMode === "flow" && <Tag variant="filled">只读投影</Tag>}
            <Segmented
              size="small"
              value={viewMode}
              onChange={changeView}
              options={[
                { value: "flow", label: "画布", icon: <EyeOutlined /> },
                { value: "source", label: "源码", icon: <CodeOutlined /> },
              ]}
            />
            <Tooltip title="保存当前文档">
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                aria-label="保存当前文档"
                loading={document.saving}
                disabled={
                  !document.dirty || Boolean(document.conflict) || Boolean(document.deleted)
                }
                onClick={() => void saveActiveEditor()}
              />
            </Tooltip>
          </Space>
        </header>

        {document.deleted && (
          <Alert banner type="error" title="文件已从项目中删除，草稿仅保留在内存中" />
        )}
        {document.conflict && (
          <Alert banner type="warning" title="检测到外部修改，请先处理文档冲突" />
        )}
        {viewMode === "source" && firstError && (
          <Alert
            banner
            type="error"
            title={firstError.message}
            action={
              <Button type="text" size="small" onClick={focusFirstError}>
                定位
              </Button>
            }
          />
        )}

        <div className={style.content}>
          {viewMode === "flow" ? (
            canvas
          ) : (
            <MfwJsonEditor
              path={`mpe-pipeline:///${encodeURIComponent(documentId)}`}
              language="json"
              value={document.workingText}
              beforeMount={configureJson}
              onMount={mountEditor}
              keepCurrentModel
              saveViewState
              options={{
                ...sourceOptions,
                readOnly: !document.descriptor.editable || Boolean(document.deleted),
              }}
              onChange={(value) =>
                updatePipelineWorkingText(documentId, value ?? "")
              }
            />
          )}
        </div>
        <ExportFileModal
          visible={exportDialogOpen}
          onCancel={closeExportDialog}
          documentId={documentId}
        />
      </section>
    );
  },
);
