import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DocumentOpenResult,
  WorkspaceDocument,
  WorkspaceDocumentsPayload,
} from "../generated/bridge-v2";
import type { LocalWebSocketServer } from "../server";
import type { MessageHandler } from "../type";
import { useDocumentStore } from "../../stores/documentStore";
import { useLocalFileStore } from "../../stores/localFileStore";
import { documentTabKey, useProjectSessionStore } from "../../stores/projectSessionStore";
import { DocumentProtocol } from "./DocumentProtocol";

const descriptor: WorkspaceDocument = {
  path: "notes.jsonc",
  name: "notes.jsonc",
  kind: "json",
  language: "json",
  mimeType: "application/json",
  size: 8,
  editable: true,
  previewable: true,
};

const opened: DocumentOpenResult = {
  ...descriptor,
  content: "{}\n",
  encoding: "utf-8",
  revision: "r1",
};

function setupClient() {
  const routes = new Map<string, MessageHandler>();
  const request = vi.fn(async () => opened);
  const client = {
    registerRoute: vi.fn((event: string, handler: MessageHandler) => {
      routes.set(event, handler);
      return () => undefined;
    }),
    request,
    getArtifactUrl: vi.fn(async () => "blob:project-image"),
  } as unknown as LocalWebSocketServer;
  const emit = (event: string, data: unknown) =>
    routes.get(event)?.(data, {} as WebSocket);
  return { client, emit, request };
}

function capabilities(
  revision = 1,
  documents: WorkspaceDocument[] = [descriptor],
): WorkspaceDocumentsPayload {
  return { revision, root: "C:/project", documents };
}

describe("DocumentProtocol", () => {
  beforeEach(() => {
    useDocumentStore.getState().clearProject();
    useProjectSessionStore.getState().clear();
    useLocalFileStore.getState().clear();
  });

  it("applies capability events and opens the matching document tab", async () => {
    const { client, emit, request } = setupClient();
    const protocol = new DocumentProtocol();
    protocol.register(client);
    emit("workspace.documents", capabilities());

    const success = await protocol.openDocument(descriptor.path);

    expect(success).toBe(true);
    expect(request).toHaveBeenCalledWith("document.open", { path: descriptor.path });
    expect(useProjectSessionStore.getState().activeKey).toBe(
      documentTabKey(descriptor.path),
    );
    expect(useDocumentStore.getState().opened[descriptor.path].content).toBe("{}\n");
  });

  it("marks a dirty document as conflicted after an external change", async () => {
    const { client, emit, request } = setupClient();
    const protocol = new DocumentProtocol();
    protocol.register(client);
    emit("workspace.documents", capabilities());
    await protocol.openDocument(descriptor.path);
    useDocumentStore.getState().updateContent(descriptor.path, "local\n");
    request.mockResolvedValueOnce({ ...opened, content: "external\n", revision: "r2" });

    emit("file.changed", {
      type: "modified",
      file_path: descriptor.path,
      is_directory: false,
    });

    await vi.waitFor(() => {
      expect(
        useDocumentStore.getState().opened[descriptor.path].conflict,
      ).toEqual({ externalContent: "external\n", externalRevision: "r2" });
    });
  });

  it("caches project images by workspace-relative path", async () => {
    const image: WorkspaceDocument = {
      ...descriptor,
      path: "image/sample.png",
      name: "sample.png",
      kind: "image",
      language: "",
      mimeType: "image/png",
      editable: false,
    };
    const imageResult: DocumentOpenResult = {
      ...image,
      revision: "image-r1",
      artifact: {
        artifactId: "artifact",
        kind: "project-image",
        mimeType: "image/png",
        size: 8,
        sha256: "image-r1",
        width: 10,
        height: 20,
        createdAt: new Date(0).toISOString(),
      },
    };
    const { client, emit, request } = setupClient();
    request.mockResolvedValueOnce(imageResult);
    const protocol = new DocumentProtocol();
    protocol.register(client);
    emit("workspace.documents", capabilities(1, [image]));

    await protocol.openDocument(image.path);

    expect(useLocalFileStore.getState().imageCache.get(image.path)).toMatchObject({
      base64: "blob:project-image",
      width: 10,
      height: 20,
    });
  });
});
