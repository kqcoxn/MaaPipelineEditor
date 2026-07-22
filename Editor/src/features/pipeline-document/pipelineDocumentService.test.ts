import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectStorageAdapter } from "../project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../project-storage/projectStorageCoordinator";
import { parseProjectPath } from "../project-session/projectPath";
import { asDocumentId, asProjectId, type DocumentId } from "../project-session/types";
import { useDocumentStore } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { usePipelineDocumentStore } from "./pipelineDocumentStore";
import {
  activatePipelineDocument,
  openPipelineDocument,
  refreshPipelineDocumentProjection,
  setPipelineViewport,
  updatePipelineWorkingText,
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
  const read = vi.fn(async (
    documentId: DocumentId,
  ): ReturnType<ProjectStorageAdapter["read"]> => {
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
    write: vi.fn(async (input) => ({
      path: input.documentId === sidecarId ? sidecarPath : pipelinePath,
      revision: "r2",
      size: new TextEncoder().encode(input.content).length,
      sha256: "sha256:test",
      operationId: input.operationId,
      encoding: input.encoding,
    })),
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
              role: "mpe_config" as const,
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
    usePipelineDocumentStore.getState().clear();
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

  it("opens invalid JSONC in source mode without turning syntax errors into storage errors", async () => {
    const source = "// invalid\n{\"Start\": }\n";
    establish(createAdapter(source));

    expect(await openPipelineDocument(pipelineId)).toBe(true);
    expect(useDocumentStore.getState().opened[pipelineId]).toMatchObject({
      workingText: source,
      dirty: false,
    });
    expect(useDocumentStore.getState().opened[pipelineId].error).toBeUndefined();
    expect(useDocumentStore.getState().opened[pipelineId].diagnostics[0]).toMatchObject({
      severity: "error",
      supportLevel: "unparseable",
    });
    expect(usePipelineDocumentStore.getState().documents[pipelineId]).toMatchObject({
      viewMode: "source",
      parseState: "invalid",
      projectionStatus: "unavailable",
    });
  });

  it("keeps the last valid projection while invalid and restores stable node ids", async () => {
    establish(createAdapter('{"Start": {}}\n'));
    expect(await openPipelineDocument(pipelineId)).toBe(true);
    const first = usePipelineDocumentStore.getState().documents[pipelineId].projection!;

    updatePipelineWorkingText(pipelineId, '{"Start": }');
    await refreshPipelineDocumentProjection(pipelineId);
    const invalid = usePipelineDocumentStore.getState().documents[pipelineId];
    expect(invalid.lastValidProjection).toBe(first);
    expect(invalid.viewMode).toBe("source");

    const recoveredSource = '// recovered\r\n{\r\n  "Start": { "timeout": 1 },\r\n}\r\n';
    updatePipelineWorkingText(pipelineId, recoveredSource);
    await refreshPipelineDocumentProjection(pipelineId);
    const recovered = usePipelineDocumentStore.getState().documents[pipelineId];
    expect(recovered.parseState).toBe("valid");
    expect(recovered.projection?.nodes[0].id).toBe(first.nodes[0].id);
    expect(useDocumentStore.getState().opened[pipelineId]).toMatchObject({
      workingText: recoveredSource,
      dirty: true,
    });
  });

  it("discards an older projection result after a newer working revision starts", async () => {
    establish(
      createAdapter(
        '{"Initial":{"$__mpe_code":{"position":{"x":0,"y":0}}}}',
        '{"file_config":{"filename":"main"},"node_configs":{}}',
      ),
      true,
    );
    expect(await openPipelineDocument(pipelineId)).toBe(true);

    updatePipelineWorkingText(
      pipelineId,
      '{"Stale":{"$__mpe_code":{"position":{"x":1,"y":1}}}}',
    );
    const staleProjection = refreshPipelineDocumentProjection(pipelineId);
    updatePipelineWorkingText(
      pipelineId,
      '{"Latest":{"$__mpe_code":{"position":{"x":2,"y":2}}}}',
    );
    const latestProjection = refreshPipelineDocumentProjection(pipelineId);
    await Promise.all([staleProjection, latestProjection]);

    const state = usePipelineDocumentStore.getState().documents[pipelineId];
    expect(state.parsedWorkingRevision).toBe(
      useDocumentStore.getState().opened[pipelineId].workingRevision,
    );
    expect(state.projection?.nodes.map((node) => node.data.label)).toEqual(["Latest"]);
  });

  it("loads an indexed sidecar without rewriting either source document", async () => {
    const source = '// pipeline\n{"Start": {}}\n';
    const sidecar = '{"file_config":{"filename":"main"},"node_configs":{}}\n';
    establish(
      createAdapter(source, sidecar),
      true,
    );
    expect(await openPipelineDocument(pipelineId)).toBe(true);

    const documents = useDocumentStore.getState().opened;
    expect(documents[pipelineId].linkedDocumentIds).toEqual([sidecarId]);
    expect(documents[pipelineId]).toMatchObject({ workingText: source, dirty: false });
    expect(documents[sidecarId]).toMatchObject({
      descriptor: { role: "mpe_config" },
      workingText: sidecar,
      dirty: false,
    });
  });

  it("saves the exact working text instead of serializing the Flow projection", async () => {
    const adapter = createAdapter('{"Start": {}}\n');
    establish(adapter);
    expect(await openPipelineDocument(pipelineId)).toBe(true);
    const exact = '\uFEFF// keep\r\n{\r\n  "Unknown": { "extension": true },\r\n}\r\n';
    updatePipelineWorkingText(pipelineId, exact);

    await expect(documentProtocol.saveDocument(pipelineId)).resolves.toMatchObject({
      status: "saved",
    });
    expect(adapter.write).toHaveBeenCalledWith(
      expect.objectContaining({ content: exact }),
    );
  });

  it("keeps same-named projections and viewports isolated by DocumentId", async () => {
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

    setPipelineViewport(secondId, { x: 12, y: 34, zoom: 1.25 });
    expect(useDocumentStore.getState().opened[secondId].dirty).toBe(false);
    expect(usePipelineDocumentStore.getState().documents[secondId].viewport).toEqual({
      x: 12,
      y: 34,
      zoom: 1.25,
    });
    expect(usePipelineDocumentStore.getState().documents[pipelineId].viewport).toBeUndefined();

    expect(await activatePipelineDocument(pipelineId)).toBe(true);
    expect(useFileStore.getState().currentFile.documentId).toBe(pipelineId);
  });
});
