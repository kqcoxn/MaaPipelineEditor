import { lazy, memo, Suspense, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  FileImageOutlined,
  FileUnknownOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { BeforeMount } from "@monaco-editor/react";

import style from "../../styles/documents/DocumentEditorHost.module.less";
import { MfwJsonEditor } from "../json/MfwJsonEditor";
import { documentProtocol } from "../../services/server";
import { useDocumentStore } from "../../stores/documentStore";
import { useLocalFileStore } from "../../stores/localFileStore";

const MonacoDiffEditor = lazy(() =>
  import("@monaco-editor/react").then((module) => ({
    default: module.DiffEditor,
  })),
);

const { Text } = Typography;

interface DocumentEditorHostProps {
  path: string;
}

const configureJson: BeforeMount = (monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    enableSchemaRequest: false,
    trailingCommas: "warning",
  });
};

const editorOptions = {
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

export const DocumentEditorHost = memo(({ path }: DocumentEditorHostProps) => {
  const document = useDocumentStore((state) => state.opened[path]);
  const imageCache = useLocalFileStore((state) => state.imageCache.get(path));
  const [saving, setSaving] = useState(false);

  const language = useMemo(() => {
    if (!document) return "plaintext";
    if (document.descriptor.kind === "interface") return "json";
    return document.descriptor.language || "plaintext";
  }, [document]);

  if (!document || document.loading) {
    return (
      <div className={style.centerState}>
        <Spin size="small" description="正在打开文件" />
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await documentProtocol.saveDocument(path);
    } finally {
      setSaving(false);
    }
  };
  const descriptor = document.descriptor;
  const imageUrl = document.imageUrl || imageCache?.base64;

  return (
    <section className={style.host} aria-label={`文档编辑器 ${descriptor.name}`}>
      <header className={style.toolbar}>
        <div className={style.identity}>
          <span className={style.name}>{descriptor.name}</span>
          <span className={style.path}>{path}</span>
        </div>
        <Space size="small">
          <Tag bordered={false}>{kindLabel(descriptor.kind)}</Tag>
          {descriptor.editable && (
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={
                !document.dirty ||
                Boolean(document.conflict) ||
                Boolean(document.deleted)
              }
              onClick={() => void save()}
            >
              保存
            </Button>
          )}
        </Space>
      </header>

      {document.deleted && (
        <Alert
          banner
          type="error"
          title="该文件已从项目中删除，当前内容仅保留在内存中。"
        />
      )}
      {document.error && <Alert banner type="error" title={document.error} />}

      <div className={style.content}>
        {document.conflict ? (
          <ConflictEditor path={path} language={language} />
        ) : descriptor.kind === "image" ? (
          <ImagePreview path={path} imageUrl={imageUrl} />
        ) : descriptor.kind === "binary" || descriptor.readOnlyReason === "too_large" ? (
          <BinaryInfo path={path} />
        ) : (
          <MfwJsonEditor
            path={`mpe-project:///${path}`}
            language={language}
            value={document.content}
            beforeMount={
              descriptor.kind === "json" || descriptor.kind === "interface"
                ? configureJson
                : undefined
            }
            options={{
              ...editorOptions,
              readOnly: !descriptor.editable || document.deleted,
            }}
            onChange={(value) =>
              useDocumentStore.getState().updateContent(path, value ?? "")
            }
          />
        )}
      </div>
    </section>
  );
});

function ConflictEditor({ path, language }: { path: string; language: string }) {
  const document = useDocumentStore((state) => state.opened[path]);
  if (!document?.conflict) return null;
  return (
    <div className={style.conflict}>
      <div className={style.conflictBar}>
        <div>
          <Text strong>检测到外部修改</Text>
          <Text type="secondary" className={style.conflictHint}>
            左侧为磁盘版本，右侧为当前本地草稿
          </Text>
        </div>
        <Space size="small">
          <Button onClick={() => useDocumentStore.getState().keepLocal(path)}>
            保留本地
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => void documentProtocol.reloadExternal(path)}
          >
            重新加载外部版本
          </Button>
        </Space>
      </div>
      <div className={style.diffEditor}>
        <Suspense
          fallback={
            <div className={style.centerState}>
              <Spin size="small" />
            </div>
          }
        >
          <MonacoDiffEditor
            original={document.conflict.externalContent}
            modified={document.content}
            language={language}
            options={{
              ...editorOptions,
              originalEditable: false,
              readOnly: true,
              renderSideBySide: true,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

function ImagePreview({ path, imageUrl }: { path: string; imageUrl?: string }) {
  const document = useDocumentStore((state) => state.opened[path]);
  const artifact = document?.artifact;
  if (!imageUrl) {
    return (
      <div className={style.centerState}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="图片加载失败" />
      </div>
    );
  }
  return (
    <div className={style.imagePreview}>
      <div className={style.imageStage}>
        <img src={imageUrl} alt={document?.descriptor.name || path} />
      </div>
      <div className={style.imageMeta}>
        <FileImageOutlined />
        <span>{formatDimensions(artifact?.width, artifact?.height)}</span>
        <span>{formatBytes(document?.descriptor.size ?? 0)}</span>
        <span className={style.metaPath}>{path}</span>
      </div>
    </div>
  );
}

function BinaryInfo({ path }: { path: string }) {
  const document = useDocumentStore((state) => state.opened[path]);
  if (!document) return null;
  const descriptor = document.descriptor;
  return (
    <div className={style.metadata}>
      <div className={style.metadataHeading}>
        <FileUnknownOutlined />
        <div>
          <Typography.Title level={4}>{descriptor.name}</Typography.Title>
          <Text type="secondary">
            {descriptor.readOnlyReason === "too_large"
              ? "文件超过安全消息上限，仅显示元信息"
              : "此文件类型不支持预览或编辑"}
          </Text>
        </div>
      </div>
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: "path", label: "项目路径", children: path },
          { key: "type", label: "MIME 类型", children: descriptor.mimeType },
          { key: "size", label: "文件大小", children: formatBytes(descriptor.size) },
          { key: "revision", label: "Revision", children: document.baseRevision },
        ]}
      />
    </div>
  );
}

function kindLabel(kind: string): string {
  if (kind === "interface") return "Interface";
  if (kind === "json") return "JSON";
  if (kind === "markdown") return "Markdown";
  if (kind === "image") return "图片";
  if (kind === "binary") return "二进制";
  return "文本";
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / 1024 / 1024).toFixed(1)} MiB`;
}

function formatDimensions(width?: number | null, height?: number | null): string {
  return width && height ? `${width} × ${height}` : "尺寸未知";
}
