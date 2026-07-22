import { Modal } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceDocument } from "../generated/bridge-v2";
import type { LocalWebSocketServer } from "../server";
import type { MessageHandler } from "../type";
import { useConfigStore } from "../../stores/configStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useLocalFileStore } from "../../stores/localFileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
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
  } as unknown as LocalWebSocketServer;
  return {
    client,
    send,
    emit: (event: string, data: unknown) =>
      routes.get(event)?.(data, {} as WebSocket),
  };
}

const documentDescriptor: WorkspaceDocument = {
  path: "resource/notes.jsonc",
  name: "notes.jsonc",
  kind: "json",
  language: "json",
  mimeType: "application/json",
  size: 2,
  editable: true,
  previewable: true,
};

describe("FileProtocol external changes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useFileStore.getState().resetProjectSession();
    useLocalFileStore.getState().clear();
    useDocumentStore.getState().clearProject();
    useProjectSessionStore.getState().clear();
    useConfigStore.getState().setConfig("fileAutoReload", true);
  });

  it("never auto-reloads a dirty Pipeline after an external modification", () => {
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().setFileConfig("filePath", "pipeline/main.json");
    useFileStore.getState().markCurrentSaved();
    useFileStore.getState().setFileConfig("prefix", "draft");
    vi.spyOn(Modal, "confirm").mockReturnValue({
      destroy: vi.fn(),
      update: vi.fn(),
    } as never);
    const { client, emit, send } = setupClient();
    const protocol = new FileProtocol();
    protocol.register(client);

    emit("file.changed", {
      type: "modified",
      file_path: "pipeline/main.json",
      is_directory: false,
    });

    expect(send).not.toHaveBeenCalledWith("file.open", expect.anything());
    expect(useFileStore.getState().currentFile.saveState).toMatchObject({
      dirty: true,
      externalChange: "modified",
    });
  });

  it("migrates Pipeline, document, index, and active tab state on directory rename", () => {
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore
      .getState()
      .setFileConfig("filePath", "resource/pipeline/main.json");
    useFileStore.getState().markCurrentSaved();
    useFileStore.getState().setFileConfig("prefix", "draft");
    const savedFingerprint =
      useFileStore.getState().currentFile.saveState.savedFingerprint;
    useLocalFileStore.getState().setFileList(
      1,
      "C:/project",
      "interface.json",
      [
        {
          file_path: "resource/pipeline/main.json",
          file_name: "main.json",
          relative_path: "resource/pipeline/main.json",
          nodes: [],
          prefix: "",
          index_status: "ready",
          is_default_pipeline: false,
        },
      ],
      ["resource/pipeline"],
    );
    useDocumentStore.getState().applyDocuments({
      revision: 1,
      root: "C:/project",
      documents: [documentDescriptor],
    });
    useDocumentStore.getState().beginOpen(documentDescriptor.path);
    useDocumentStore.getState().finishOpen({
      ...documentDescriptor,
      content: "{}",
      encoding: "utf-8",
      revision: "r1",
    });
    useDocumentStore.getState().updateContent(documentDescriptor.path, "draft");
    useProjectSessionStore
      .getState()
      .openPipeline("resource/pipeline/main.json");
    useProjectSessionStore.getState().openDocument(documentDescriptor.path);
    const { client, emit } = setupClient();
    const protocol = new FileProtocol();
    protocol.register(client);

    emit("file.changed", {
      type: "renamed",
      file_path: "resource",
      new_file_path: "assets/resource",
      is_directory: true,
    });

    expect(useFileStore.getState().currentFile).toMatchObject({
      config: { filePath: "assets/resource/pipeline/main.json" },
      saveState: { dirty: true, savedFingerprint },
    });
    expect(useLocalFileStore.getState().files[0].file_path).toBe(
      "assets/resource/pipeline/main.json",
    );
    expect(useDocumentStore.getState().opened).toHaveProperty(
      "assets/resource/notes.jsonc",
    );
    expect(useProjectSessionStore.getState().activeKey).toBe(
      "document:assets/resource/notes.jsonc",
    );
  });

  it("migrates the sidecar path when a Pipeline file is renamed", () => {
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().setFileConfig("filePath", "pipeline/main.json");
    useFileStore
      .getState()
      .setFileConfig("separatedConfigPath", "pipeline/.main.mpe.json");
    const { client, emit } = setupClient();
    const protocol = new FileProtocol();
    protocol.register(client);

    emit("file.changed", {
      type: "renamed",
      file_path: "pipeline/main.json",
      new_file_path: "pipeline/renamed.json",
      is_directory: false,
    });

    expect(useFileStore.getState().currentFile).toMatchObject({
      fileName: "renamed",
      config: {
        filePath: "pipeline/renamed.json",
        separatedConfigPath: "pipeline/.renamed.mpe.json",
      },
    });
  });
});
