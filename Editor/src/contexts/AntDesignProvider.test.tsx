import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider, Modal } from "antd";
import { afterEach, describe, expect, it } from "vitest";

import {
  AntDesignProvider,
  configureAntDesignStaticHolders,
} from "./AntDesignProvider";

afterEach(() => {
  Modal.destroyAll();
  ConfigProvider.config({ holderRender: undefined });
  cleanup();
});

describe("AntDesignProvider", () => {
  it("centers declarative modals by default", () => {
    render(
      <AntDesignProvider>
        <Modal open title="Declarative modal" footer={null}>
          Content
        </Modal>
      </AntDesignProvider>,
    );

    expect(screen.getByRole("dialog").parentElement).toHaveClass(
      "ant-modal-centered",
    );
  });

  it("centers static modals by default", async () => {
    configureAntDesignStaticHolders();
    Modal.confirm({ title: "Static modal", content: "Content" });

    await waitFor(() => {
      expect(screen.getByRole("dialog").parentElement).toHaveClass(
        "ant-modal-centered",
      );
    });
  });
});
