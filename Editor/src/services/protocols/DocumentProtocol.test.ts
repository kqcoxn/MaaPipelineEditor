import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectStorageAdapter } from "../../features/project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../../features/project-storage/projectStorageCoordinator";
import { parseProjectPath } from "../../features/project-session/projectPath";
import { asDocumentId, asProjectId } from "../../features/project-session/types";
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
    read: vi.fn(async () => openResult(content, revision)),
    write: vi.fn(async (input) => ({
      path: "notes.jsonc",
      revision: "r2",
      size: input.content.length,
      sha256: "r2",
      operationId: input.operationId,
      encoding: input.encoding,
    })),
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    watch: vi.fn(() => () => undefined),
  };
}

function openResult(content: string, revision: string) {
  return {
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
    encoding: "utf-8" as const,
  };
}

function establish(currentAdapter: ProjectStorageAdapter, kind: "json" | "pipeline" = "json") {
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
        kind,
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
    projectStorageCoordinator.destroy();
    useProjectSessionStore.getState().clear();
    useDocumentStore.getState().clearProject();
  });

  it.each(["json", "pipeline"] as const)(
    "opens and saves %s through the same document adapter",
    async (kind) => {
      const storage = adapter();
      establish(storage, kind);
      const protocol = new DocumentProtocol();

      expect(await protocol.openDocument(documentId)).toBe(true);
      useDocumentStore.getState().updateWorkingText(documentId, '{"a":1}');
      const outcome = await protocol.saveDocument(documentId);

      expect(outcome.status).toBe("saved");
      expect(storage.read).toHaveBeenCalledWith(documentId);
      expect(storage.write).toHaveBeenCalledWith({
        documentId,
        content: '{"a":1}',
        expectedRevision: "r1",
        encoding: "utf-8",
        operationId: expect.any(String),
        reason: "user",
      });
      expect(useDocumentStore.getState().opened[documentId].dirty).toBe(false);
    },
  );

  it("ignores self and duplicate external notifications", async () => {
    let releaseWrite!: () => void;
    const storage = adapter();
    vi.mocked(storage.write).mockImplementation(
      (input) =>
        new Promise((resolve) => {
          releaseWrite = () =>
            resolve({
              path: "notes.jsonc",
              revision: "r2",
              size: input.content.length,
              sha256: "r2",
              operationId: input.operationId,
              encoding: input.encoding,
            });
        }),
    );
    establish(storage);
    const protocol = new DocumentProtocol();
    await protocol.openDocument(documentId);
    useDocumentStore.getState().updateWorkingText(documentId, "local");

    const saving = protocol.saveDocument(documentId);
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalled());
    const operationId = vi.mocked(storage.write).mock.calls[0][0].operationId;
    await protocol.refreshFromExternal(documentId, operationId);
    expect(storage.read).toHaveBeenCalledTimes(1);
    releaseWrite();
    await saving;

    vi.mocked(storage.read).mockResolvedValueOnce(openResult("duplicate", "r2"));
    await protocol.refreshFromExternal(documentId, "watcher:duplicate");
    expect(useDocumentStore.getState().opened[documentId].conflict).toBeUndefined();
  });

  it("retains a dirty draft and external source after a revision conflict", async () => {
    const storage = adapter();
    establish(storage);
    const protocol = new DocumentProtocol();
    await protocol.openDocument(documentId);
    useDocumentStore.getState().updateWorkingText(documentId, "local");
    vi.mocked(storage.write).mockRejectedValueOnce(new Error("文件已被外部修改"));
    vi.mocked(storage.read).mockResolvedValueOnce({
      ...openResult("external", "r2"),
      encoding: "utf-8-bom",
    });

    const outcome = await protocol.saveDocument(documentId);

    expect(outcome.status).toBe("failed");
    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      workingText: "local",
      dirty: true,
      conflict: {
        externalText: "external",
        externalRevision: "r2",
        externalEncoding: "utf-8-bom",
      },
    });
  });

  it("returns per-document outcomes and preserves a failed dirty sidecar", async () => {
    const sidecarId = asDocumentId("document:sidecar");
    const storage = adapter();
    establish(storage, "pipeline");
    const protocol = new DocumentProtocol();
    await protocol.openDocument(documentId);
    useDocumentStore.getState().updateWorkingText(documentId, "pipeline");
    useDocumentStore.getState().registerDraft(
      sidecarId,
      { ...openResult("{}", "s1"), path: ".notes.mpe.json", name: ".notes.mpe.json", role: "mpe_config" },
      "sidecar",
      { saved: true },
    );
    useDocumentStore.getState().updateWorkingText(sidecarId, "changed sidecar");
    useDocumentStore.getState().setLinkedDocuments(documentId, [sidecarId]);
    vi.mocked(storage.write).mockImplementation(async (input) => {
      if (input.documentId === sidecarId) throw new Error("sidecar failed");
      return {
        path: "notes.jsonc",
        revision: "r2",
        size: input.content.length,
        sha256: "r2",
        operationId: input.operationId,
        encoding: input.encoding,
      };
    });

    const outcomes = await protocol.saveDocumentGroup(documentId, "save-all");

    expect(outcomes.map(({ status }) => status)).toEqual(["saved", "failed"]);
    expect(useDocumentStore.getState().opened[documentId].dirty).toBe(false);
    expect(useDocumentStore.getState().opened[sidecarId].dirty).toBe(true);
  });
});
