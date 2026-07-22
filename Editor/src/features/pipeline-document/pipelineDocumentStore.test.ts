import { beforeEach, describe, expect, it } from "vitest";

import { asDocumentId } from "../project-session/types";
import { usePipelineDocumentStore } from "./pipelineDocumentStore";

describe("pipelineDocumentStore", () => {
  beforeEach(() => usePipelineDocumentStore.getState().clear());

  it("isolates view and viewport state by DocumentId", () => {
    const first = asDocumentId("document:first");
    const second = asDocumentId("document:second");
    const store = usePipelineDocumentStore.getState();

    store.ensureDocument(first);
    store.ensureDocument(second);
    store.setViewMode(first, "source");
    store.setViewport(first, { x: 1, y: 2, zoom: 1.2 });

    expect(usePipelineDocumentStore.getState().documents[first]).toMatchObject({
      viewMode: "source",
      viewport: { x: 1, y: 2, zoom: 1.2 },
    });
    expect(usePipelineDocumentStore.getState().documents[second].viewMode).toBe("flow");
    expect(usePipelineDocumentStore.getState().documents[second].viewport).toBeUndefined();
  });

  it("releases per-document session state", () => {
    const documentId = asDocumentId("document:closed");
    usePipelineDocumentStore.getState().ensureDocument(documentId);

    usePipelineDocumentStore.getState().removeDocument(documentId);

    expect(usePipelineDocumentStore.getState().documents[documentId]).toBeUndefined();
  });
});
