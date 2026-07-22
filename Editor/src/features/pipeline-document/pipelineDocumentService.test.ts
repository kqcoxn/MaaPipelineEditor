import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectStorageAdapter } from "../project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../project-storage/projectStorageCoordinator";
import { parseProjectPath } from "../project-session/projectPath";
import { asDocumentId, asProjectId, type DocumentId } from "../project-session/types";
import { useConfigStore } from "../../stores/configStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import {
  activatePipelineDocument,
  openPipelineDocument,
  syncCurrentPipelineToDocuments,
} from "./pipelineDocumentService";
import { documentProtocol } from "../../services/server";

const pipelineId = asDocumentId("document:pipeline");
const sidecarId = asDocumentId("document:sidecar");
const pipelinePath = "resource/pipeline/main.jsonc";
const sidecarPath = "resource/pipeline/.main.mpe.json";
const identity = {
  projectId: asProjectId("project:pipeline-test"),
  projectRoot: "C:/project",
  interfacePath: parseProjectPath("interface.json"),
  name: "test",
  label: "Test",
  version: "1.0.0",
};

function createAdapter(source: string, sidecar?: string): ProjectStorageAdapter {
  const read = vi.fn(async (documentId: DocumentId) => {
    const isSidecar = documentId === sidecarId;
    const content = isSidecar ? sidecar ?? "{}\n" : source;
    const path = isSidecar ? sidecarPath : pipelinePath;
    return {
      path,
      name: path.split("/").at(-1)!,
      kind: isSidecar ? ("json" as const) : ("pipeline" as const),
      language: "json",
      mimeType: "application/json",
      size: content.length,
      editable: true,
      previewable: true,
      role: isSidecar ? "mpe_config" : null,
      content,
      revision: isSidecar ? "sidecar:r1" : "pipeline:r1",
      encoding: "utf-8" as const,
    };
  });
  return {
    kind: "localbridge",
    identity,
    capabilities: () => ({
      projectId: identity.projectId,
      pathCaseSensitive: true,
      operations: {
        list: { available: true },
        read: { available: true },
        write: { available: true },
        create: { available: true },
      },
    }),
    list: vi.fn(async () => ({
      revision: 1,
      projectId: identity.projectId,
      entries: [],
    })),
    read,
    write: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    watch: vi.fn(() => () => undefined),
  };
}

function establish(adapter: ProjectStorageAdapter, includeSidecar = false): void {
  projectStorageCoordinator.setAdapter(adapter);
  useProjectSessionStore.getState().applyEntries({
    revision: 1,
    projectId: identity.projectId,
    entries: [
      {
        path: pipelinePath,
        name: "main.jsonc",
        entryKind: "file",
        documentId: pipelineId,
        kind: "pipeline",
        language: "json",
        mimeType: "application/json",
        size: 2,
        editable: true,
        previewable: true,
      },
      ...(includeSidecar
        ? [
            {
              path: sidecarPath,
              name: ".main.mpe.json",
              entryKind: "file" as const,
              documentId: sidecarId,
              kind: "json" as const,
              language: "json",
              mimeType: "application/json",
              size: 2,
              editable: true,
              previewable: true,
              role: "mpe_config",
            },
          ]
        : []),
    ],
  });
}

describe("pipelineDocumentService", () => {
  beforeEach(() => {
    projectStorageCoordinator.destroy();
    useProjectSessionStore.getState().clear();
    useDocumentStore.getState().clearProject();
    useFileStore.getState().resetProjectSession();
    useConfigStore.getState().resetAllConfigs();
  });

  it("builds the Flow from JSONC while preserving untouched source text", async () => {
    const source = '// comment\r\n{\r\n  "Second": {},\r\n  "First": {}\r\n}\r\n';
    const adapter = createAdapter(source);
    establish(adapter);

    expect(await openPipelineDocument(pipelineId)).toBe(true);
    expect(useDocumentStore.getState().opened[pipelineId]).toMatchObject({
      savedText: source,
      workingText: source,
      dirty: false,
    });
    expect(useFileStore.getState().currentFile.documentId).toBe(pipelineId);

    const outcome = await documentProtocol.saveDocument(pipelineId);
    expect(outcome.status).toBe("clean");
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it("keeps the document and source when Pipeline parsing fails", async () => {
    const source = "// invalid\n{\"Start\": }\n";
    establish(createAdapter(source));

    expect(await openPipelineDocument(pipelineId)).toBe(false);
    expect(useDocumentStore.getState().opened[pipelineId]).toMatchObject({
      workingText: source,
      dirty: false,
      error: expect.any(String),
    });
  });

  it("loads an indexed sidecar before projection changes update both documents", async () => {
    useConfigStore.getState().setConfig("configHandlingMode", "separated");
    establish(
      createAdapter(
        '{"Start": {}}\n',
        '{"file_config":{"filename":"main"},"node_configs":{}}\n',
      ),
      true,
    );
    expect(await openPipelineDocument(pipelineId)).toBe(true);
    useFileStore.getState().setFileConfig("prefix", "Changed");

    await syncCurrentPipelineToDocuments();

    const documents = useDocumentStore.getState().opened;
    expect(documents[pipelineId].linkedDocumentIds).toEqual([sidecarId]);
    expect(documents[pipelineId].dirty).toBe(true);
    expect(documents[sidecarId]).toMatchObject({
      descriptor: { role: "mpe_config" },
      dirty: true,
    });
  });

  it("creates a linked in-memory sidecar draft only when no indexed sidecar exists", async () => {
    useConfigStore.getState().setConfig("configHandlingMode", "separated");
    establish(createAdapter('{"Start": {}}\n'));
    expect(await openPipelineDocument(pipelineId)).toBe(true);
    useFileStore.getState().setFileConfig("prefix", "Draft");

    await syncCurrentPipelineToDocuments();

    const primary = useDocumentStore.getState().opened[pipelineId];
    expect(primary.linkedDocumentIds).toHaveLength(1);
    const draft = useDocumentStore.getState().opened[primary.linkedDocumentIds[0]];
    expect(draft).toMatchObject({
      path: sidecarPath,
      savedRevision: "",
      dirty: true,
      descriptor: { role: "mpe_config" },
    });
  });

  it("keeps same-named Pipeline projections isolated by DocumentId", async () => {
    const secondId = asDocumentId("document:pipeline-second");
    const secondPath = "resource/other/pipeline/main.jsonc";
    const adapter = createAdapter('{"First": {}}\n');
    vi.mocked(adapter.read).mockImplementation(async (documentId) => {
      const second = documentId === secondId;
      const content = second ? '{"Second": {}}\n' : '{"First": {}}\n';
      const path = second ? secondPath : pipelinePath;
      return {
        path,
        name: "main.jsonc",
        kind: "pipeline",
        language: "json",
        mimeType: "application/json",
        size: content.length,
        editable: true,
        previewable: true,
        content,
        revision: second ? "second:r1" : "first:r1",
        encoding: "utf-8",
      };
    });
    projectStorageCoordinator.setAdapter(adapter);
    useProjectSessionStore.getState().applyEntries({
      revision: 1,
      projectId: identity.projectId,
      entries: [
        {
          path: pipelinePath,
          name: "main.jsonc",
          entryKind: "file",
          documentId: pipelineId,
          kind: "pipeline",
          editable: true,
        },
        {
          path: secondPath,
          name: "main.jsonc",
          entryKind: "file",
          documentId: secondId,
          kind: "pipeline",
          editable: true,
        },
      ],
    });

    expect(await openPipelineDocument(pipelineId)).toBe(true);
    expect(await openPipelineDocument(secondId)).toBe(true);
    expect(useFileStore.getState().files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: pipelineId, fileName: "main" }),
        expect.objectContaining({ documentId: secondId, fileName: "main" }),
      ]),
    );

    useFileStore.getState().setFileConfig("prefix", "SecondChanged");
    await syncCurrentPipelineToDocuments();
    expect(useDocumentStore.getState().opened[pipelineId].dirty).toBe(false);
    expect(useDocumentStore.getState().opened[secondId].dirty).toBe(true);

    expect(await activatePipelineDocument(pipelineId)).toBe(true);
    expect(useFileStore.getState().currentFile.documentId).toBe(pipelineId);
  });
});
