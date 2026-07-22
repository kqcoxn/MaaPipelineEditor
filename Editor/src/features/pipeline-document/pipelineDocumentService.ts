import { parse, type ParseError } from "jsonc-parser";

import {
  flowToPipelineString,
  flowToSeparatedStrings,
  type MpeConfigType,
} from "../../core/parser";
import { documentProtocol } from "../../services/server";
import { useConfigStore } from "../../stores/configStore";
import { useDocumentStore, type OpenDocument } from "../../stores/documentStore";
import { useFileStore, type FileType } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { asDocumentId, type DocumentId } from "../project-session/types";

let projectionLoadDepth = 0;

export async function openPipelineDocument(documentId: DocumentId): Promise<boolean> {
  if (!(await documentProtocol.openDocument(documentId))) return false;
  return loadPipelineProjection(documentId);
}

export async function activatePipelineDocument(documentId: DocumentId): Promise<boolean> {
  const file = useFileStore.getState().findFileByDocumentId(documentId);
  if (!file) return openPipelineDocument(documentId);
  projectionLoadDepth += 1;
  try {
    useProjectSessionStore.getState().activateTab(documentId);
  } finally {
    projectionLoadDepth -= 1;
  }
  return loadPipelineProjection(documentId);
}

export async function reloadPipelineProjection(documentId: DocumentId): Promise<boolean> {
  if (!useDocumentStore.getState().opened[documentId]) return false;
  return loadPipelineProjection(documentId);
}

export async function syncCurrentPipelineToDocuments(): Promise<void> {
  if (projectionLoadDepth > 0) return;
  const file = useFileStore.getState().currentFile;
  const document = useDocumentStore.getState().opened[file.documentId];
  if (!document || document.descriptor.kind !== "pipeline") return;

  const options = pipelineExportOptions(file);
  if (useConfigStore.getState().configs.configHandlingMode === "separated") {
    const { pipelineString, configString } = flowToSeparatedStrings(options);
    useDocumentStore
      .getState()
      .updateWorkingText(document.documentId, withTrailingNewline(pipelineString));
    const metadataId = await ensureMetadataDraft(
      document,
      withTrailingNewline(configString),
    );
    if (!metadataId) return;
    useDocumentStore
      .getState()
      .updateWorkingText(metadataId, withTrailingNewline(configString));
    return;
  }

  useDocumentStore
    .getState()
    .updateWorkingText(
      document.documentId,
      withTrailingNewline(flowToPipelineString(options)),
    );
}

async function loadPipelineProjection(documentId: DocumentId): Promise<boolean> {
  const document = useDocumentStore.getState().opened[documentId];
  if (!document) return false;
  projectionLoadDepth += 1;
  try {
    const metadata = await loadMetadataDocument(document);
    const success = await useFileStore.getState().openFileFromLocal(
      document.path,
      document.workingText,
      metadata?.config,
      metadata?.document.path,
      documentId,
    );
    if (!success) {
      useDocumentStore.getState().failOpen(documentId, "Pipeline 解析失败，画布已锁定");
    }
    return success;
  } finally {
    projectionLoadDepth -= 1;
  }
}

async function loadMetadataDocument(
  pipelineDocument: OpenDocument,
): Promise<{ document: OpenDocument; config: MpeConfigType } | undefined> {
  const session = useProjectSessionStore.getState();
  const metadataPath = separatedMetadataPath(pipelineDocument.path);
  const metadataId =
    session.documentIdByPath[metadataPath] ??
    session.documentIdByPath[metadataPath.replace(/\.json$/i, ".jsonc")];
  if (!metadataId) return undefined;
  if (!(await documentProtocol.openDocument(metadataId, { activate: false }))) {
    return undefined;
  }
  const document = useDocumentStore.getState().opened[metadataId];
  if (!document) return undefined;
  const errors: ParseError[] = [];
  const config = parse(document.workingText, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as MpeConfigType | undefined;
  if (!config || errors.length > 0) {
    useDocumentStore.getState().failOpen(metadataId, "MPE sidecar 解析失败");
    return undefined;
  }
  useDocumentStore.getState().setLinkedDocuments(pipelineDocument.documentId, [metadataId]);
  return { document, config };
}

async function ensureMetadataDraft(
  pipelineDocument: OpenDocument,
  text: string,
): Promise<DocumentId | undefined> {
  const linked = pipelineDocument.linkedDocumentIds
    .map((documentId) => useDocumentStore.getState().opened[documentId])
    .find((document) => document?.descriptor.role === "mpe_config");
  if (linked) return linked.documentId;

  const path = separatedMetadataPath(pipelineDocument.path);
  const indexedId = useProjectSessionStore.getState().documentIdByPath[path];
  if (indexedId) {
    if (!(await documentProtocol.openDocument(indexedId, { activate: false }))) {
      return undefined;
    }
    useDocumentStore.getState().setLinkedDocuments(pipelineDocument.documentId, [indexedId]);
    return indexedId;
  }

  const name = path.split("/").at(-1) ?? ".pipeline.mpe.json";
  const documentId = useProjectSessionStore
    .getState()
    .registerDraft(name, "json", asDocumentId(`draft:${crypto.randomUUID()}`));
  useDocumentStore.getState().registerDraft(
    documentId,
    {
      path,
      name,
      kind: "json",
      language: "json",
      mimeType: "application/json",
      size: new TextEncoder().encode(text).length,
      editable: true,
      previewable: true,
      role: "mpe_config",
    },
    text,
  );
  useDocumentStore.getState().setLinkedDocuments(pipelineDocument.documentId, [documentId]);
  useFileStore.getState().setFileConfig("separatedConfigPath", path);
  return documentId;
}

function pipelineExportOptions(file: FileType) {
  return {
    nodes: file.nodes,
    edges: file.edges,
    fileName: file.fileName,
    config: file.config,
  };
}

function separatedMetadataPath(pipelinePath: string): string {
  const segments = pipelinePath.split("/");
  const fileName = segments.pop() ?? "pipeline.json";
  const stem = fileName.replace(/\.(json|jsonc)$/i, "");
  return [...segments, `.${stem}.mpe.json`].join("/");
}

function withTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
