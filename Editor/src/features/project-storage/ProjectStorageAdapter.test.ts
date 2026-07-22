import { beforeEach, describe, expect, it, vi } from "vitest";

const embedMocks = vi.hoisted(() => ({
  onParentMessage: vi.fn(() => () => undefined),
  requestParent: vi.fn(),
  sendToParent: vi.fn(),
}));

vi.mock("../../utils/embedBridge", () => embedMocks);

import { asDocumentId } from "../project-session/types";
import { BrowserProjectStorageAdapter } from "./BrowserProjectStorageAdapter";
import { EmbeddedHostProjectStorageAdapter } from "./EmbeddedHostProjectStorageAdapter";
import { LocalBridgeProjectStorageAdapter } from "./LocalBridgeProjectStorageAdapter";
import type {
  ProjectStorageAdapter,
  ProjectStorageOperation,
} from "./ProjectStorageAdapter";
import { getCapability } from "./ProjectStorageAdapter";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { useFileStore } from "../../stores/fileStore";

const operations: ProjectStorageOperation[] = [
  "list",
  "read",
  "write",
  "create",
  "rename",
  "delete",
  "watch",
  "execute",
  "externalPaths",
];

function expectCapabilityContract(adapter: ProjectStorageAdapter): void {
  const capabilities = adapter.capabilities();
  expect(capabilities.projectId).toBe(adapter.identity.projectId);
  operations.forEach((operation) => {
    const capability = getCapability(capabilities, operation);
    expect(typeof capability.available).toBe("boolean");
    if (!capability.available) expect(capability.reason).toBeTruthy();
  });
}

function directoryHandle(name = "project"): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    values: async function* () {},
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    isSameEntry: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
  } as unknown as FileSystemDirectoryHandle;
}

function pipelineDirectory(): {
  handle: FileSystemDirectoryHandle;
  write: ReturnType<typeof vi.fn>;
} {
  const write = vi.fn();
  const file = new File(
    ['{"$mpe":{"prefix":"Demo"},"Demo_Start":{"anchor":["Entry"]}}'],
    "main.json",
    { type: "application/json" },
  );
  const fileHandle = {
    kind: "file",
    name: "main.json",
    getFile: vi.fn(async () => file),
    createWritable: vi.fn(async () => ({
      write,
      close: vi.fn(),
    })),
  } as unknown as FileSystemFileHandle;
  const pipeline = {
    ...directoryHandle("pipeline"),
    values: async function* () {
      yield fileHandle;
    },
    getFileHandle: vi.fn(async () => fileHandle),
  } as unknown as FileSystemDirectoryHandle;
  const resource = {
    ...directoryHandle("resource"),
    values: async function* () {
      yield pipeline;
    },
    getDirectoryHandle: vi.fn(async () => pipeline),
  } as unknown as FileSystemDirectoryHandle;
  const handle = {
    ...directoryHandle(),
    values: async function* () {
      yield resource;
    },
    getDirectoryHandle: vi.fn(async () => resource),
  } as unknown as FileSystemDirectoryHandle;
  return { handle, write };
}

describe("ProjectStorageAdapter contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectSessionStore.getState().clear();
    useFileStore.getState().resetProjectSession();
  });

  it("exposes a draft-only Browser temporary project", async () => {
    const adapter = new BrowserProjectStorageAdapter();

    expectCapabilityContract(adapter);
    expect(getCapability(adapter.capabilities(), "list")).toMatchObject({
      available: false,
      reason: "directory_handle_required",
    });
    await expect(adapter.list()).resolves.toMatchObject({
      projectId: adapter.identity.projectId,
      entries: [],
    });
  });

  it("keeps Browser directory identity stable per handle without name collisions", async () => {
    const handle = directoryHandle();
    const sameHandle = new BrowserProjectStorageAdapter(handle);
    const reconnect = new BrowserProjectStorageAdapter(handle);
    const sameNameOtherHandle = new BrowserProjectStorageAdapter(
      directoryHandle(),
    );

    expectCapabilityContract(sameHandle);
    expect(sameHandle.identity.projectId).toBe(reconnect.identity.projectId);
    expect(sameHandle.identity.projectId).not.toBe(
      sameNameOtherHandle.identity.projectId,
    );
    expect(getCapability(sameHandle.capabilities(), "write").available).toBe(true);
    expect(getCapability(sameHandle.capabilities(), "rename")).toMatchObject({
      available: false,
      reason: "browser_rename_not_supported",
    });
    await expect(sameHandle.list()).resolves.toMatchObject({ entries: [] });
  });

  it("indexes and saves a Pipeline through the unified Browser write contract", async () => {
    const { handle, write } = pipelineDirectory();
    const adapter = new BrowserProjectStorageAdapter(handle);
    const listed = await adapter.list();
    const entry = listed.entries.find(
      (item) => item.path === "resource/pipeline/main.json",
    );
    expect(entry).toMatchObject({
      kind: "pipeline",
      pipeline: {
        prefix: "Demo",
        indexStatus: "ready",
        nodes: [
          { label: "Demo_Start", prefix: "Demo", anchors: ["Entry"] },
        ],
      },
    });
    const documentId = asDocumentId(entry?.documentId ?? "");
    const opened = await adapter.read(documentId);
    const result = await adapter.write({
      documentId,
      content: '{"Demo_Start":{}}\n',
      expectedRevision: opened.revision,
      encoding: "utf-8-bom",
      operationId: "save:browser",
      reason: "user",
    });

    expect(write).toHaveBeenCalledWith('\ufeff{"Demo_Start":{}}\n');
    expect(result).toMatchObject({
      operationId: "save:browser",
      encoding: "utf-8-bom",
    });
  });

  it("defaults EmbeddedHost to a read-only temporary project", async () => {
    const adapter = new EmbeddedHostProjectStorageAdapter({
      entries: { revision: 1, projectId: "embed:test", entries: [] },
    });

    expectCapabilityContract(adapter);
    expect(getCapability(adapter.capabilities(), "write")).toMatchObject({
      available: false,
      reason: "host_capability_not_declared",
    });
    await expect(adapter.list()).resolves.toMatchObject({ revision: 1, entries: [] });
  });

  it("routes declared EmbeddedHost operations through request/response", async () => {
    embedMocks.requestParent.mockResolvedValue({
      path: "notes.jsonc",
      revision: "r2",
      size: 2,
      sha256: "r2",
      operationId: "save:embedded",
      encoding: "utf-8",
    });
    const adapter = new EmbeddedHostProjectStorageAdapter({
      project: { projectId: "embed:writable" },
      storageCapabilities: {
        projectId: "embed:writable",
        pathCaseSensitive: true,
        operations: Object.fromEntries(
          operations.map((operation) => [
            operation === "externalPaths" ? "external_paths" : operation,
            { available: true },
          ]),
        ),
      },
    });
    const documentId = asDocumentId("document:notes");

    expectCapabilityContract(adapter);
    await adapter.write({
      documentId,
      content: "{}",
      expectedRevision: "r1",
      encoding: "utf-8",
      operationId: "save:embedded",
      reason: "before-run",
    });

    expect(embedMocks.requestParent).toHaveBeenCalledWith(
      "mpe:projectRequest",
      {
        method: "document.save",
        params: {
          documentId,
          content: "{}",
          expectedRevision: "r1",
          encoding: "utf-8",
          operationId: "save:embedded",
          reason: "before-run",
        },
      },
      "mpe:projectResponse",
    );
    expect(embedMocks.sendToParent).not.toHaveBeenCalled();
  });

  it("maps LocalBridge list calls and session capabilities", async () => {
    const request = vi.fn(async () => ({
      revision: 1,
      projectId: "localbridge:pending",
      entries: [],
    }));
    const adapter = new LocalBridgeProjectStorageAdapter({
      request,
      registerRoute: vi.fn(() => () => undefined),
    } as never);
    useProjectSessionStore.getState().setCapabilities({
      projectId: adapter.identity.projectId,
      pathCaseSensitive: false,
      operations: Object.fromEntries(
        operations.map((operation) => [
          operation === "externalPaths" ? "external_paths" : operation,
          { available: true },
        ]),
      ),
    });

    expectCapabilityContract(adapter);
    await expect(adapter.list()).resolves.toMatchObject({ entries: [] });
    expect(request).toHaveBeenCalledWith("project.entries.list", {});
  });

  it("maps LocalBridge document writes with revision, encoding and operation id", async () => {
    const documentId = asDocumentId("document:pipeline");
    const request = vi.fn(async () => ({
      path: "pipeline/main.jsonc",
      revision: "r2",
      size: 3,
      sha256: "r2",
      operationId: "save:localbridge",
      encoding: "utf-8",
    }));
    const adapter = new LocalBridgeProjectStorageAdapter({
      request,
      registerRoute: vi.fn(() => () => undefined),
    } as never);
    useProjectSessionStore.getState().establishSession(adapter.identity, "localbridge");
    useProjectSessionStore.getState().applyEntries({
      revision: 1,
      projectId: "localbridge:pending",
      entries: [
        {
          path: "pipeline/main.jsonc",
          name: "main.jsonc",
          entryKind: "file",
          documentId,
          kind: "pipeline",
          editable: true,
        },
      ],
    });

    await adapter.write({
      documentId,
      content: "{}\n",
      expectedRevision: "r1",
      encoding: "utf-8",
      operationId: "save:localbridge",
      reason: "save-all",
    });

    expect(request).toHaveBeenCalledWith("document.save", {
      path: "pipeline/main.jsonc",
      content: "{}\n",
      expected_revision: "r1",
      encoding: "utf-8",
      operation_id: "save:localbridge",
      reason: "save-all",
    });
  });
});
