import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openExternalUrl,
  registerEmbedExternalNavigation,
} from "./externalNavigation";

describe("externalNavigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?embed=true&origin=vscode-maa");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("delegates external URLs to the embed host", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    expect(openExternalUrl("https://example.com/docs")).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mpe:openExternalRequest",
        payload: { url: "https://example.com/docs" },
      }),
      "*",
    );
  });

  it("intercepts external anchor clicks in embed mode", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);
    const cleanup = registerEmbedExternalNavigation();
    const anchor = document.createElement("a");
    anchor.href = "https://example.com/guide";
    anchor.textContent = "Guide";
    document.body.appendChild(anchor);

    anchor.click();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mpe:openExternalRequest",
        payload: { url: "https://example.com/guide" },
      }),
      "*",
    );
    cleanup();
  });

  it("rejects unsafe URL protocols", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    expect(openExternalUrl("javascript:alert(1)")).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("keeps browser navigation in standalone mode", () => {
    window.history.replaceState({}, "", "/");
    const browserOpen = vi
      .spyOn(window, "open")
      .mockImplementation(() => window);

    expect(openExternalUrl("https://example.com/releases")).toBe(true);
    expect(browserOpen).toHaveBeenCalledWith(
      "https://example.com/releases",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
