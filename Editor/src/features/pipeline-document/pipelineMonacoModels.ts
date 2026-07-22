import type { editor, MarkerSeverity } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

import type { DocumentId } from "../project-session/types";
import type { DocumentDiagnostic } from "../../stores/documentStore";

const models = new Map<DocumentId, editor.ITextModel>();
const editors = new Map<DocumentId, editor.IStandaloneCodeEditor>();

export function registerPipelineEditor(
  documentId: DocumentId,
  instance: editor.IStandaloneCodeEditor,
): void {
  const model = instance.getModel();
  if (model) models.set(documentId, model);
  editors.set(documentId, instance);
}

export function updatePipelineMarkers(
  monaco: Monaco,
  documentId: DocumentId,
  diagnostics: DocumentDiagnostic[],
): void {
  const model = models.get(documentId);
  if (!model) return;
  monaco.editor.setModelMarkers(
    model,
    "mpe-pipeline",
    diagnostics.map((item) => {
      const start = model.getPositionAt(item.offset);
      const end = model.getPositionAt(item.offset + Math.max(item.length, 1));
      return {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
        message: item.message,
        code: item.code,
        severity: markerSeverity(monaco, item.severity),
      };
    }),
  );
}

export function revealPipelineDiagnostic(
  documentId: DocumentId,
  diagnostic: DocumentDiagnostic,
): boolean {
  const instance = editors.get(documentId);
  const model = models.get(documentId);
  if (!instance || !model) return false;
  const start = model.getPositionAt(diagnostic.offset);
  const end = model.getPositionAt(
    diagnostic.offset + Math.max(diagnostic.length, 1),
  );
  instance.setSelection({
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  });
  instance.revealPositionInCenter(start);
  instance.focus();
  return true;
}

export function disposePipelineModel(documentId: DocumentId): void {
  editors.delete(documentId);
  models.get(documentId)?.dispose();
  models.delete(documentId);
}

function markerSeverity(
  monaco: Monaco,
  severity: DocumentDiagnostic["severity"],
): MarkerSeverity {
  if (severity === "error") return monaco.MarkerSeverity.Error;
  if (severity === "warning") return monaco.MarkerSeverity.Warning;
  return monaco.MarkerSeverity.Info;
}
