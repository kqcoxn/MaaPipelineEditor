import { beforeEach, describe, expect, it } from "vitest";

import { asDocumentId, asProjectId } from "../features/project-session/types";
import { parseProjectPath } from "../features/project-session/projectPath";
import { useProjectSessionStore } from "./projectSessionStore";

const identity = (projectId: string) => ({
  projectId: asProjectId(projectId),
  projectRoot: "C:/project",
  interfacePath: parseProjectPath("interface.json"),
  name: "project",
  label: "Project",
  version: "1.0.0",
});

const entries = (projectId = "project:a") => ({
  revision: 1,
  projectId,
  entries: [
    { path: "pipeline", name: "pipeline", entryKind: "directory" as const },
    {
      path: "pipeline/main.json",
      name: "main.json",
      entryKind: "file" as const,
      documentId: "document:main",
      kind: "pipeline" as const,
    },
    {
      path: "README.md",
      name: "README.md",
      entryKind: "file" as const,
      documentId: "document:readme",
      kind: "markdown" as const,
    },
  ],
});

describe("projectSessionStore", () => {
  beforeEach(() => useProjectSessionStore.getState().clear());

  it("uses DocumentId as the only tab identity", () => {
    const store = useProjectSessionStore.getState();
    store.establishSession(identity("project:a"), "localbridge");
    store.applyEntries(entries());
    const pipelineId = asDocumentId("document:main");
    const readmeId = asDocumentId("document:readme");

    store.openDocument(pipelineId);
    store.openDocument(readmeId);
    store.openDocument(pipelineId);

    expect(useProjectSessionStore.getState().tabs).toEqual([
      { documentId: pipelineId },
      { documentId: readmeId },
    ]);
    expect(useProjectSessionStore.getState().activeDocumentId).toBe(pipelineId);
  });

  it("keeps ProjectSessionId stable when reconnecting to the same project", () => {
    const store = useProjectSessionStore.getState();
    store.establishSession(identity("project:a"), "localbridge");
    const first = useProjectSessionStore.getState().sessionId;
    store.prepareReconnect();
    store.establishSession(identity("project:a"), "localbridge");

    expect(useProjectSessionStore.getState().sessionId).toBe(first);
    expect(useProjectSessionStore.getState().availability).toBe("ready");
  });

  it("starts a new session and retains drafts when project identity changes", () => {
    const store = useProjectSessionStore.getState();
    store.establishSession(identity("project:a"), "localbridge");
    store.applyEntries(entries());
    const oldSession = useProjectSessionStore.getState().sessionId;
    const draftId = store.registerDraft("draft", "pipeline");
    store.openDocument(draftId);

    store.establishSession(identity("project:b"), "localbridge");

    const next = useProjectSessionStore.getState();
    expect(next.sessionId).not.toBe(oldSession);
    expect(next.tabs).toEqual([{ documentId: draftId }]);
    expect(next.entriesById[draftId]?.name).toBe("draft");
    expect(next.entriesById[asDocumentId("document:main")]).toBeUndefined();
  });

  it("migrates paths, DocumentIds, tabs, and active identity from rename mappings", () => {
    const store = useProjectSessionStore.getState();
    store.establishSession(identity("project:a"), "localbridge");
    store.applyEntries(entries());
    store.openDocument(asDocumentId("document:main"));

    store.applyDocumentMappings([
      {
        oldPath: "pipeline/main.json",
        newPath: "flows/main.json",
        oldDocumentId: "document:main",
        newDocumentId: "document:renamed",
      },
    ]);

    const state = useProjectSessionStore.getState();
    expect(state.documentIdByPath["flows/main.json"]).toBe("document:renamed");
    expect(state.entriesByPath["flows/main.json"]?.name).toBe("main.json");
    expect(state.tabs).toEqual([
      { documentId: asDocumentId("document:renamed") },
    ]);
    expect(state.activeDocumentId).toBe("document:renamed");
  });
});
