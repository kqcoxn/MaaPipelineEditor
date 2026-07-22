import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseProjectPath } from "../project-session/projectPath";
import { asProjectId } from "../project-session/types";
import type { ProjectStorageAdapter } from "./ProjectStorageAdapter";
import { projectStorageCoordinator } from "./projectStorageCoordinator";
import { useProjectSessionStore } from "../../stores/projectSessionStore";

function pendingLocalBridge(): ProjectStorageAdapter {
  return {
    kind: "localbridge",
    identity: {
      projectId: asProjectId("localbridge:pending"),
      projectRoot: "",
      interfacePath: parseProjectPath("interface.json"),
      name: "",
      label: "",
      version: "",
    },
    capabilities: () => ({
      projectId: null,
      pathCaseSensitive: true,
      operations: {},
    }),
    list: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    savePipeline: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    watch: vi.fn(() => () => undefined),
  };
}

describe("projectStorageCoordinator", () => {
  beforeEach(() => {
    projectStorageCoordinator.destroy();
    useProjectSessionStore.getState().clear();
  });

  it("does not replace the established session with a pending reconnect identity", () => {
    const store = useProjectSessionStore.getState();
    store.establishSession(
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
    const sessionId = useProjectSessionStore.getState().sessionId;

    projectStorageCoordinator.setAdapter(pendingLocalBridge());

    expect(useProjectSessionStore.getState()).toMatchObject({
      sessionId,
      identity: { projectId: "project:test" },
      availability: "connecting",
      connected: true,
    });
  });
});
