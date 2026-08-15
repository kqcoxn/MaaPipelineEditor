import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "@/stores/embed/embedStore";
import * as antdAppApi from "../../../utils/ui/antdAppApi";
import { clearEmbedOperationTimeouts } from "../actions/embedOperations";
import { showEmbedSaveConflict } from "./saveConflict";

interface CapturedModalConfig {
  title: ReactNode;
  content: ReactNode;
  okText: ReactNode;
  cancelText: ReactNode;
  onOk: () => void;
  onCancel: () => void;
  footer: (
    originNode: ReactNode,
    extra: { OkBtn: () => ReactNode; CancelBtn: () => ReactNode },
  ) => ReactNode;
}

describe("showEmbedSaveConflict", () => {
  let confirm: ReturnType<typeof vi.fn>;
  let destroy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useEmbedStore.getState().reset();
    useEmbedStore.getState().setReady(true);
    destroy = vi.fn();
    confirm = vi.fn(() => ({ destroy }));
    vi.spyOn(antdAppApi, "getAntdAppApi").mockReturnValue({
      modal: { confirm },
    } as never);
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearEmbedOperationTimeouts();
    document.documentElement.lang = "";
    vi.restoreAllMocks();
  });

  function getConfig(): CapturedModalConfig {
    return confirm.mock.calls[0][0] as CapturedModalConfig;
  }

  it("uses host.name and offers a generic force save when allowed", () => {
    document.documentElement.lang = "zh-CN";
    useEmbedStore
      .getState()
      .initConfig({}, {}, { id: "mse", name: "Maa Support" });
    useEmbedStore.getState().beginSave("save-conflict");
    useEmbedStore.getState().beginSaveConflict("save-conflict");

    showEmbedSaveConflict({ canForce: true });

    const config = getConfig();
    expect(config.okText).toBe("从 Maa Support 同步");
    expect(config.content).toContain("Maa Support 中的数据");
    render(
      <>{config.footer(null, {
        OkBtn: () => <button>sync</button>,
        CancelBtn: () => <button>cancel</button>,
      })}</>,
    );
    fireEvent.click(screen.getByText("强制覆盖"));

    expect(destroy).toHaveBeenCalledOnce();
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mpe:saveRequest",
        payload: { hint: "user-confirmed-force", force: true },
      }),
      "*",
    );
    expect(useEmbedStore.getState().saveOperation.status).toBe("pending");
  });

  it("falls back to English Host and hides overwrite when disallowed", () => {
    document.documentElement.lang = "en-US";
    useEmbedStore.getState().beginSave("save-conflict");
    useEmbedStore.getState().beginSaveConflict("save-conflict");

    showEmbedSaveConflict({ canForce: false });

    const config = getConfig();
    expect(config.okText).toBe("Sync from Host");
    expect(config.cancelText).toBe("Cancel");
    expect(config.content).toBe(
      "The data in Host changed after it was loaded into MPE. Syncing replaces the current MPE content with the host data. Overwriting replaces the host changes with the current MPE content.",
    );
    render(
      <>{config.footer(null, {
        OkBtn: () => <button>sync</button>,
        CancelBtn: () => <button>cancel</button>,
      })}</>,
    );
    expect(screen.queryByText("Overwrite")).not.toBeInTheDocument();

    config.onOk();
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mpe:reloadRequest" }),
      "*",
    );
    expect(useEmbedStore.getState().saveOperation.status).toBe("idle");
  });

  it("cancels without sending requests or clearing dirty state", () => {
    document.documentElement.lang = "zh-CN";
    useEmbedStore.getState().setDirty(true);
    useEmbedStore.getState().beginSave("save-conflict");
    useEmbedStore.getState().beginSaveConflict("save-conflict");

    showEmbedSaveConflict({ canForce: true });
    getConfig().onCancel();

    expect(window.parent.postMessage).not.toHaveBeenCalled();
    expect(useEmbedStore.getState()).toMatchObject({
      isDirty: true,
      saveOperation: { status: "idle", requestId: null },
    });
  });
});
