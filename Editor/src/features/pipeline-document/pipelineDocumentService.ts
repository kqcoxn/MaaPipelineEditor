import { parse, type ParseError } from "jsonc-parser";

import { documentProtocol } from "../../services/server";
import { useDocumentStore, type OpenDocument } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useFlowStore } from "../../stores/flow";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import type { MpeConfigType } from "../../core/parser";
import type { Viewport } from "@xyflow/react";
import { asDocumentId, type DocumentId } from "../project-session/types";
import { analyzePipelineSource } from "./pipelineSourceAnalysis";
import { buildPipelineProjection } from "./pipelineProjectionBuilder";
import { layoutPipelineProjection } from "./pipelineProjectionLayout";
import { usePipelineDocumentStore } from "./pipelineDocumentStore";
import { disposePipelineModel } from "./pipelineMonacoModels";
import type { PipelineFlowProjection, PipelineViewMode } from "./types";

const SOURCE_PARSE_DELAY_MS = 250;
const parseTimers = new Map<DocumentId, ReturnType<typeof setTimeout>>();
const parseGenerations = new Map<DocumentId, number>();

export async function openPipelineDocument(documentId: DocumentId): Promise<boolean> {
  if (!(await documentProtocol.openDocument(documentId))) return false;
  await refreshPipelineDocumentProjection(documentId);
  return true;
}

export async function activatePipelineDocument(documentId: DocumentId): Promise<boolean> {
  const document = useDocumentStore.getState().opened[documentId];
  if (!document) return openPipelineDocument(documentId);
  useProjectSessionStore.getState().activateTab(documentId);
  const state = usePipelineDocumentStore.getState().documents[documentId];
  if (state?.projection) applyProjection(document, state.projection);
  else await refreshPipelineDocumentProjection(documentId);
  restoreViewport(documentId);
  return true;
}

export async function reloadPipelineProjection(documentId: DocumentId): Promise<boolean> {
  if (!useDocumentStore.getState().opened[documentId]) return false;
  await refreshPipelineDocumentProjection(documentId);
  return true;
}

export function updatePipelineWorkingText(
  documentId: DocumentId,
  text: string,
): void {
  useDocumentStore.getState().updateWorkingText(documentId, text);
  schedulePipelineProjection(documentId);
}

export function setPipelineViewMode(
  documentId: DocumentId,
  viewMode: PipelineViewMode,
): boolean {
  const state = usePipelineDocumentStore.getState().ensureDocument(documentId);
  if (viewMode === "flow" && state.parseState === "invalid") {
    usePipelineDocumentStore.getState().setViewMode(documentId, "source");
    return false;
  }
  usePipelineDocumentStore.getState().setViewMode(documentId, viewMode);
  return true;
}

export function setPipelineViewport(documentId: DocumentId, viewport: Viewport): void {
  usePipelineDocumentStore.getState().setViewport(documentId, viewport);
}

export function initializePipelineDocumentService(): () => void {
  return useDocumentStore.subscribe(
    (state) => state.opened,
    (opened, previous) => {
      Object.entries(opened).forEach(([rawId, document]) => {
        const documentId = asDocumentId(rawId);
        const before = previous[documentId];
        const changed =
          !before ||
          before.workingRevision !== document.workingRevision ||
          before.workingText !== document.workingText;
        if (!changed) return;
        if (document.descriptor.kind === "pipeline") {
          schedulePipelineProjection(documentId);
          return;
        }
        Object.values(opened)
          .filter(
            (candidate) =>
              candidate.descriptor.kind === "pipeline" &&
              candidate.linkedDocumentIds.includes(documentId),
          )
          .forEach((candidate) => schedulePipelineProjection(candidate.documentId));
      });
      Object.keys(previous).forEach((rawId) => {
        const documentId = asDocumentId(rawId);
        if (!opened[documentId]) releasePipelineDocument(documentId);
      });
    },
  );
}

export function releasePipelineDocument(documentId: DocumentId): void {
  const timer = parseTimers.get(documentId);
  if (timer) clearTimeout(timer);
  parseTimers.delete(documentId);
  parseGenerations.delete(documentId);
  usePipelineDocumentStore.getState().removeDocument(documentId);
  disposePipelineModel(documentId);
}

function schedulePipelineProjection(documentId: DocumentId): void {
  const previous = parseTimers.get(documentId);
  if (previous) clearTimeout(previous);
  const generation = (parseGenerations.get(documentId) ?? 0) + 1;
  parseGenerations.set(documentId, generation);
  parseTimers.set(
    documentId,
    setTimeout(() => {
      parseTimers.delete(documentId);
      void refreshPipelineDocumentProjection(documentId, generation);
    }, SOURCE_PARSE_DELAY_MS),
  );
}

export async function refreshPipelineDocumentProjection(
  documentId: DocumentId,
  scheduledGeneration?: number,
): Promise<void> {
  if (scheduledGeneration === undefined) {
    const timer = parseTimers.get(documentId);
    if (timer) clearTimeout(timer);
    parseTimers.delete(documentId);
  }
  const document = useDocumentStore.getState().opened[documentId];
  if (!document || document.descriptor.kind !== "pipeline") return;
  const generation = scheduledGeneration ?? (parseGenerations.get(documentId) ?? 0) + 1;
  if (scheduledGeneration === undefined) parseGenerations.set(documentId, generation);

  const analysis = analyzePipelineSource(document.workingText);
  if (parseGenerations.get(documentId) !== generation) return;
  const store = usePipelineDocumentStore.getState();
  if (!analysis.syntaxValid) {
    useDocumentStore.getState().setDiagnostics(documentId, analysis.diagnostics);
    store.updateDocument(documentId, (state) => ({
      ...state,
      viewMode: "source",
      parseState: "invalid",
      projectionStatus: "unavailable",
      syntaxTree: analysis.root,
      sourceMap: analysis.sourceMap,
      parsedWorkingRevision: document.workingRevision,
    }));
    return;
  }

  const metadata = await loadMetadataDocument(document);
  if (parseGenerations.get(documentId) !== generation) return;
  let projection = analysis.value
    ? buildPipelineProjection({
        pipeline: analysis.value,
        keyOrder: rootKeyOrder(analysis.sourceMap),
        mpeConfig: metadata?.config,
      })
    : emptyProjection();
  projection = await layoutPipelineProjection(projection);
  if (parseGenerations.get(documentId) !== generation) return;
  useDocumentStore.getState().setDiagnostics(documentId, analysis.diagnostics);
  const partial = analysis.diagnostics.some(
    (item) => item.supportLevel === "graph-unsupported",
  );
  store.updateDocument(documentId, (state) => ({
    ...state,
    parseState: "valid",
    projectionStatus: partial ? "partial" : "ready",
    syntaxTree: analysis.root,
    sourceMap: analysis.sourceMap,
    projection,
    lastValidProjection: projection,
    parsedWorkingRevision: document.workingRevision,
  }));
  if (useProjectSessionStore.getState().activeDocumentId === documentId) {
    applyProjection(document, projection);
    restoreViewport(documentId);
  }
}

function applyProjection(
  document: OpenDocument,
  projection: PipelineFlowProjection,
): void {
  useFileStore
    .getState()
    .applyDocumentProjection(document.documentId, document.path, projection);
}

function restoreViewport(documentId: DocumentId): void {
  const viewport = usePipelineDocumentStore.getState().documents[documentId]?.viewport;
  if (!viewport) return;
  setTimeout(() => {
    if (useProjectSessionStore.getState().activeDocumentId !== documentId) return;
    useFlowStore.getState().instance?.setViewport(viewport, { duration: 0 });
  }, 0);
}

async function loadMetadataDocument(
  pipelineDocument: OpenDocument,
): Promise<{ document: OpenDocument; config: MpeConfigType } | undefined> {
  if (!pipelineDocument.path) return undefined;
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
  useDocumentStore
    .getState()
    .setLinkedDocuments(pipelineDocument.documentId, [metadataId]);
  const errors: ParseError[] = [];
  const parsed = parse(document.workingText, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;
  if (!parsed || errors.length > 0) {
    useDocumentStore.getState().setDiagnostics(
      metadataId,
      errors.map((error) => ({
        code: "pipeline.sidecar.syntax",
        severity: "error" as const,
        message: "关联可视化配置不是有效的 JSONC",
        offset: error.offset,
        length: Math.max(error.length, 1),
        path: [],
        supportLevel: "unparseable" as const,
      })),
    );
    return undefined;
  }
  if (!isMpeConfig(parsed)) {
    useDocumentStore.getState().setDiagnostics(metadataId, [
      {
        code: "pipeline.sidecar.structure",
        severity: "error",
        message: "关联可视化配置缺少 file_config 或 node_configs",
        offset: 0,
        length: Math.max(document.workingText.length, 1),
        path: [],
        supportLevel: "graph-unsupported",
      },
    ]);
    return undefined;
  }
  useDocumentStore.getState().setDiagnostics(metadataId, []);
  return { document, config: parsed };
}

function isMpeConfig(value: unknown): value is MpeConfigType {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.file_config === "object" &&
    candidate.file_config !== null &&
    !Array.isArray(candidate.file_config) &&
    typeof candidate.node_configs === "object" &&
    candidate.node_configs !== null &&
    !Array.isArray(candidate.node_configs)
  );
}

function rootKeyOrder(
  sourceMap: ReturnType<typeof analyzePipelineSource>["sourceMap"],
): string[] {
  const keys = sourceMap?.locations
    .filter((location) => location.path.length === 1)
    .map((location) => location.path[0])
    .filter((key): key is string => typeof key === "string") ?? [];
  return [...new Set(keys)];
}

function emptyProjection(): PipelineFlowProjection {
  return {
    nodes: [],
    edges: [],
    config: { prefix: "" },
    hasAuthoredPositions: false,
  };
}

function separatedMetadataPath(pipelinePath: string): string {
  const segments = pipelinePath.split("/");
  const fileName = segments.pop() ?? "pipeline.json";
  const stem = fileName.replace(/\.(json|jsonc)$/i, "");
  return [...segments, `.${stem}.mpe.json`].join("/");
}
