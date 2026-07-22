import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveDocument: vi.fn(async () => true),
}));

vi.mock("./server", () => ({
  documentProtocol: { saveDocument: mocks.saveDocument },
}));

import { parseProjectPath } from "../features/project-session/projectPath";
import {
  asDocumentId,
  asProjectId,
  type DocumentId,
} from "../features/project-session/types";
import type { ProjectStorageAdapter } from "../features/project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../features/project-storage/projectStorageCoordinator";
import { useDocumentStore } from "../stores/documentStore";
import type { FileType } from "../stores/fileStore";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useToolbarStore } from "../stores/toolbarStore";
import { saveActiveEditor } from "./editorCommands";

const projectId = asProjectId("project:test");
const identity = {
  projectId,
  projectRoot: "C:/project",
  interfacePath: parseProjectPath("interface.json"),
  name: "test",
  label: "Test",
  version: "1.0.0",
};
const capabilities = {
  projectId,
  pathCaseSensitive: true,
  operations: {
    list: { available: true },
    read: { available: true },
    write: { available: true },
  },
};

function createAdapter(
  savePipeline: ProjectStorageAdapter["savePipeline"] = vi.fn(
    async () => "saved" as const,
  ),
  kind: ProjectStorageAdapter["kind"] = "localbridge",
): ProjectStorageAdapter {
  return {
    kind,
    identity,
    capabilities: () => capabilities,
    list: vi.fn(async () => ({ revision: 1, projectId, entries: [] })),
    read: vi.fn(),
    write: vi.fn(),
    savePipeline,
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    watch: vi.fn(() => () => undefined),
  };
}

function applyEntry(documentId: DocumentId, path: string, kind: "pipeline" | "json") {
  useProjectSessionStore.getState().applyEntries({
    revision: 1,
    projectId,
    entries: [
      {
        path,
        name: path.split("/").at(-1) ?? path,
        entryKind: "file",
        documentId,
        kind,
        language: "json",
        mimeType: "application/json",
        size: 2,
        editable: true,
        previewable: true,
      },
    ],
  });
  useProjectSessionStore.getState().openDocument(documentId);
}

function pipeline(documentId: DocumentId, path?: string): FileType {
  return {
    documentId,
    fileName: "main",
    nodes: [],
    edges: [],
    config: { prefix: "draft", filePath: path },
    saveState: {
      dirty: true,
      savedFingerprint: "baseline",
      saving: false,
    },
  };
}

describe("saveActiveEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStorageCoordinator.destroy();
    useProjectSessionStore.getState().clear();
    useDocumentStore.getState().clearProject();
    useToolbarStore.getState().closeExportDialog();
    useFileStore.getState().resetProjectSession();
  });

  it("routes ordinary documents through the active adapter command", async () => {
    const documentId = asDocumentId("document:notes");
    projectStorageCoordinator.setAdapter(createAdapter());
    applyEntry(documentId, "notes.jsonc", "json");
    const descriptor = {
      path: "notes.jsonc",
      name: "notes.jsonc",
      kind: "json" as const,
      language: "json",
      mimeType: "application/json",
      size: 2,
      editable: true,
      previewable: true,
    };
    useDocumentStore.getState().beginOpen(documentId, descriptor);
    useDocumentStore.getState().finishOpen(documentId, {
      ...descriptor,
      revision: "r1",
      content: "{}",
    });
    useDocumentStore.getState().updateContent(documentId, '{"dirty":true}');

    await expect(saveActiveEditor()).resolves.toBe("saved");

    expect(mocks.saveDocument).toHaveBeenCalledWith(documentId);
  });

  it("routes project Pipelines through the active adapter", async () => {
    const documentId = asDocumentId("document:pipeline");
    const savePipeline = vi.fn(async () => "saved" as const);
    projectStorageCoordinator.setAdapter(createAdapter(savePipeline));
    applyEntry(documentId, "pipeline/main.json", "pipeline");
    const file = pipeline(documentId, "pipeline/main.json");
    useFileStore.setState({ files: [file], currentFile: file });

    await expect(saveActiveEditor()).resolves.toBe("saved");

    expect(savePipeline).toHaveBeenCalledWith(documentId, file, {
      allowOverwrite: false,
    });
  });

  it("opens ExportCopy for a pathless Pipeline draft", async () => {
    const documentId = asDocumentId("draft:pipeline");
    projectStorageCoordinator.setAdapter(
      createAdapter(vi.fn(async () => "unsupported" as const)),
    );
    useProjectSessionStore.getState().registerDraft("main", "pipeline", documentId);
    useProjectSessionStore.getState().openDocument(documentId);
    const file = pipeline(documentId);
    useFileStore.setState({ files: [file], currentFile: file });

    await expect(saveActiveEditor()).resolves.toBe("export-requested");

    expect(useToolbarStore.getState().exportDialogOpen).toBe(true);
  });

  it("delegates embedded Pipeline saves to the host adapter", async () => {
    const documentId = asDocumentId("draft:embedded-pipeline");
    const savePipeline = vi.fn(async () => "delegated" as const);
    projectStorageCoordinator.setAdapter(createAdapter(savePipeline, "embedded"));
    useProjectSessionStore
      .getState()
      .registerDraft("main", "pipeline", documentId);
    useProjectSessionStore.getState().openDocument(documentId);
    const file = pipeline(documentId);
    useFileStore.setState({ files: [file], currentFile: file });

    await expect(saveActiveEditor()).resolves.toBe("delegated");

    expect(savePipeline).toHaveBeenCalledWith(documentId, file);
  });
});
