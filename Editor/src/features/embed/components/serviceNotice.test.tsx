import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { showEmbedServiceNotice } from "./serviceNotice";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
}));

vi.mock("../../../utils/ui/antdAppApi", () => ({
  getAntdAppApi: () => ({ modal: { confirm: mocks.confirm } }),
}));

describe("showEmbedServiceNotice", () => {
  beforeEach(() => {
    mocks.confirm.mockReset();
    useEmbedStore.getState().reset();
    useEmbedStore.getState().initConfig({}, {}, {
      id: "mse",
      name: "Maa Pipeline Support",
    });
  });

  it("recommends staying in the host and links to the quick start guide", () => {
    showEmbedServiceNotice("流程调试");

    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        okText: "留在 Maa Pipeline Support",
        cancelText: "查看 MPE 快速开始",
        cancelButtonProps: expect.objectContaining({
          href: "https://mpe.codax.site/docs/guide/start/quick-start.html",
          target: "_blank",
          rel: "noopener noreferrer",
        }),
      }),
    );
  });
});
