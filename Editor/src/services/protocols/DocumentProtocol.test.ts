import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectStorageAdapter } from "../../features/project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../../features/project-storage/projectStorageCoordinator";
import { asDocumentId, asProjectId } from "../../features/project-session/types";
import { parseProjectPath } from "../../features/project-session/projectPath";
import { useDocumentStore } from "../../stores/documentStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { DocumentProtocol } from "./DocumentProtocol";

const documentId = asDocumentId("document:notes");
const identity = {
  projectId: asProjectId("project:test"),
  projectRoot: "C:/project",
  interfacePath: parseProjectPath("interface.json"),
  name: "test",
  label: "Test",
  version: "1.0.0",
};
const capabilities = {
  projectId: "project:test",
  pathCaseSensitive: true,
  operations: {
    list: { available: true },
    read: { available: true },
    write: { available: true },
  },
};

function adapter(content = "{}", revision = "r1"): ProjectStorageAdapter {
  return {
    kind: "localbridge",
    identity,
    capabilities: () => capabilities,
    list: vi.fn(async () => ({ revision: 1, projectId: "project:test", entries: [] })),
    read: vi.fn(async () => ({
      path: "notes.jsonc",
      name: "notes.jsonc",
      kind: "json" as const,
      language: "json",
      mimeType: "application/json",
      size: content.length,
      editable: true,
      previewable: true,
      content,
      revision,
    })),
    write: vi.fn(async () => ({ path: "notes.jsonc", revision: "r2", size: 2, sha256: "r2" })),
    savePipeline: vi.fn(async () => "unsupported" as const),
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    watch: vi.fn(() => () => undefined),
  };
}

function establish(currentAdapter: ProjectStorageAdapter) {
  projectStorageCoordinator.setAdapter(currentAdapter);
  useProjectSessionStore.getState().applyEntries({
    revision: 1,
    projectId: "project:test",
    entries: [
      {
        path: "notes.jsonc",
        name: "notes.jsonc",
        entryKind: "file",
        documentId,
        kind: "json",
        language: "json",
        mimeType: "application/json",
        size: 2,
        editable: true,
        previewable: true,
      },
    ],
  });
}

describe("DocumentProtocol", () => {
  beforeEach(() => {
    useProjectSessionStore.getState().clear();
    useDocumentStore.getState().clearProject();
  });

  it("opens and saves through the active storage adapter", async () => {
    const storage = adapter();
    establish(storage);
    const protocol = new DocumentProtocol();

    expect(await protocol.openDocument(documentId)).toBe(true);
    useDocumentStore.getState().updateContent(documentId, '{"a":1}');
    expect(await protocol.saveDocument(documentId)).toBe(true);

    expect(storage.read).toHaveBeenCalledWith(documentId);
    expect(storage.write).toHaveBeenCalledWith(documentId, '{"a":1}', "r1");
    expect(useProjectSessionStore.getState().activeDocumentId).toBe(documentId);
    expect(useDocumentStore.getState().opened[documentId].dirty).toBe(false);
  });

  it("retains a dirty draft when external content changes", async () => {
    const storage = adapter();
    establish(storage);
    const protocol = new DocumentProtocol();
    await protocol.openDocument(documentId);
    useDocumentStore.getState().updateContent(documentId, "local");
    vi.mocked(storage.read).mockResolvedValueOnce({
      path: "notes.jsonc",
      name: "notes.jsonc",
      kind: "json",
      language: "json",
      mimeType: "application/json",
      size: 8,
      editable: true,
      previewable: true,
      content: "external",
      revision: "r2",
    });

    await protocol.refreshFromExternal(documentId);

    expect(useDocumentStore.getState().opened[documentId].conflict).toEqual({
      externalContent: "external",
      externalRevision: "r2",
    });
  });
});
