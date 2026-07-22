import { Modal } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { asDocumentId, asProjectId } from "../../features/project-session/types";
import { parseProjectPath } from "../../features/project-session/projectPath";
import { useConfigStore } from "../../stores/configStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import type { LocalWebSocketServer } from "../server";
import type { MessageHandler } from "../type";
import { FileProtocol } from "./FileProtocol";

function setupClient() {
  const routes = new Map<string, MessageHandler>();
  const send = vi.fn(() => true);
  const client = {
    registerRoute: vi.fn((event: string, handler: MessageHandler) => {
      routes.set(event, handler);
      return () => undefined;
    }),
    send,
    request: vi.fn(async () => ({ revision: 2, projectId: "project:test", entries: [] })),
  } as unknown as LocalWebSocketServer;
  return {
    client,
    send,
    emit: (event: string, data: unknown) =>
      routes.get(event)?.(data, {} as WebSocket),
  };
}

function establishPipeline(path = "pipeline/main.json") {
  const documentId = asDocumentId("document:main");
  const session = useProjectSessionStore.getState();
  session.establishSession(
    {
      projectId: asProjectId("project:test"),
      projectRoot: "C:/project",
      interfacePath: parseProjectPath("interface.json"),
      name: "test",
      label: "Test",
      version: "1.0.0",
    },
    "localbridge",
  );
  session.applyEntries({
    revision: 1,
    projectId: "project:test",
    entries: [
      {
        path,
        name: path.split("/").at(-1)!,
        entryKind: "file",
        documentId,
        kind: "pipeline",
      },
    ],
  });
  useFileStore.getState().addFile({ isSwitch: true });
  useFileStore.getState().setFileConfig("filePath", path);
  useFileStore.setState((state) => ({
    currentFile: { ...state.currentFile, documentId },
    files: state.files.map((file) => ({ ...file, documentId })),
  }));
  session.openDocument(documentId);
  return documentId;
}

describe("FileProtocol project changes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useFileStore.getState().resetProjectSession();
    useDocumentStore.getState().clearProject();
    useProjectSessionStore.getState().clear();
    useConfigStore.getState().setConfig("fileAutoReload", true);
  });

  it("never auto-reloads a dirty Pipeline after an external modification", () => {
    establishPipeline();
    useFileStore.getState().markCurrentSaved();
    useFileStore.getState().setFileConfig("prefix", "draft");
    vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() } as never);
    const { client, emit, send } = setupClient();
    const protocol = new FileProtocol();
    protocol.register(client);

    emit("project.changed", {
      projectId: "project:test",
      operationId: "modify:1",
      change: "modified",
      path: "pipeline/main.json",
      isDirectory: false,
      documentMappings: [],
    });

    expect(send).not.toHaveBeenCalledWith("file.open", expect.anything());
    expect(useFileStore.getState().currentFile.saveState).toMatchObject({
      dirty: true,
      externalChange: "modified",
    });
  });

  it("migrates Pipeline identity, sidecar, and active tab from rename mappings", () => {
    const oldId = establishPipeline();
    useFileStore.getState().setFileConfig("separatedConfigPath", "pipeline/.main.mpe.json");
    const { client, emit } = setupClient();
    const protocol = new FileProtocol();
    protocol.register(client);

    emit("project.changed", {
      projectId: "project:test",
      operationId: "rename:1",
      change: "renamed",
      path: "pipeline/main.json",
      newPath: "pipeline/renamed.json",
      isDirectory: false,
      documentMappings: [
        {
          oldPath: "pipeline/main.json",
          newPath: "pipeline/renamed.json",
          oldDocumentId: oldId,
          newDocumentId: "document:renamed",
        },
      ],
    });

    expect(useFileStore.getState().currentFile).toMatchObject({
      documentId: "document:renamed",
      fileName: "renamed",
      config: {
        filePath: "pipeline/renamed.json",
        separatedConfigPath: "pipeline/.renamed.mpe.json",
      },
    });
    expect(useProjectSessionStore.getState().activeDocumentId).toBe(
      "document:renamed",
    );
  });
});
