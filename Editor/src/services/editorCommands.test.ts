import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveDocumentGroup: vi.fn(async () => []),
  saveAllDirty: vi.fn(async () => []),
}));

vi.mock("./server", () => ({
  documentProtocol: {
    saveDocumentGroup: mocks.saveDocumentGroup,
    saveAllDirty: mocks.saveAllDirty,
  },
}));

import { parseProjectPath } from "../features/project-session/projectPath";
import { asDocumentId, asProjectId, type DocumentId } from "../features/project-session/types";
import { useDocumentStore } from "../stores/documentStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useToolbarStore } from "../stores/toolbarStore";
import { saveActiveEditor, saveAllDocuments } from "./editorCommands";

const projectId = asProjectId("project:test");

function establish(documentId: DocumentId, kind: "pipeline" | "json", path: string) {
  const session = useProjectSessionStore.getState();
  session.establishSession(
    {
      projectId,
      projectRoot: "C:/project",
      interfacePath: parseProjectPath("interface.json"),
      name: "test",
      label: "Test",
      version: "1.0.0",
    },
    "localbridge",
  );
  session.setCapabilities({
    projectId,
    pathCaseSensitive: true,
    operations: { write: { available: true } },
  });
  session.applyEntries({
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
  session.openDocument(documentId);
  const descriptor = {
    path,
    name: path.split("/").at(-1) ?? path,
    kind,
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
    encoding: "utf-8",
  });
  useDocumentStore.getState().updateWorkingText(documentId, '{"dirty":true}');
}

describe("editor document save commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectSessionStore.getState().clear();
    useDocumentStore.getState().clearProject();
    useToolbarStore.getState().closeExportDialog();
  });

  it.each(["json", "pipeline"] as const)(
    "saves the active %s document through its associated document group",
    async (kind) => {
      const documentId = asDocumentId(`document:${kind}`);
      establish(documentId, kind, `${kind}/main.jsonc`);
      mocks.saveDocumentGroup.mockResolvedValueOnce([
        { documentId, status: "saved", name: "main.jsonc" },
      ]);

      await expect(saveActiveEditor()).resolves.toBe("saved");

      expect(mocks.saveDocumentGroup).toHaveBeenCalledWith(documentId, "user");
      expect(useDocumentStore.getState().opened[documentId].workingText).toBe(
        '{"dirty":true}',
      );
    },
  );

  it("saves a Pipeline and its linked sidecar as one group", async () => {
    const documentId = asDocumentId("document:pipeline");
    const sidecarId = asDocumentId("document:sidecar");
    establish(documentId, "pipeline", "pipeline/main.jsonc");
    useDocumentStore.getState().registerDraft(
      sidecarId,
      {
        path: "pipeline/.main.mpe.json",
        name: ".main.mpe.json",
        kind: "json",
        language: "json",
        mimeType: "application/json",
        size: 2,
        editable: true,
        previewable: true,
        role: "mpe_config",
      },
      "{}",
    );
    useDocumentStore.getState().setLinkedDocuments(documentId, [sidecarId]);
    mocks.saveDocumentGroup.mockResolvedValueOnce([
      { documentId, status: "saved", name: "main.jsonc" },
      { documentId: sidecarId, status: "saved", name: ".main.mpe.json" },
    ]);

    await expect(saveActiveEditor()).resolves.toBe("saved");
    expect(mocks.saveDocumentGroup).toHaveBeenCalledWith(documentId, "user");
  });

  it("opens export for a pathless dirty draft", async () => {
    const documentId = asDocumentId("draft:pipeline");
    const session = useProjectSessionStore.getState();
    session.registerDraft("main", "pipeline", documentId);
    session.openDocument(documentId);
    useDocumentStore.getState().registerDraft(
      documentId,
      {
        path: "",
        name: "main",
        kind: "pipeline",
        language: "json",
        mimeType: "application/json",
        size: 2,
        editable: true,
        previewable: true,
      },
      "{}",
    );

    await expect(saveActiveEditor()).resolves.toBe("export-requested");
    expect(useToolbarStore.getState().exportDialogOpen).toBe(true);
  });

  it("saves all dirty documents with the save-all reason", async () => {
    const documentId = asDocumentId("document:notes");
    establish(documentId, "json", "notes.jsonc");
    mocks.saveAllDirty.mockResolvedValueOnce([
      { documentId, status: "saved", name: "notes.jsonc" },
    ]);

    const outcomes = await saveAllDocuments();

    expect(outcomes).toHaveLength(1);
    expect(mocks.saveAllDirty).toHaveBeenCalledWith("save-all");
  });
});
