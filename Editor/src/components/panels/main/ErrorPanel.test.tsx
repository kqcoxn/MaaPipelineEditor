import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorTypeEnum, useErrorStore } from "@/stores/app/errorStore";
import ErrorPanel from "./ErrorPanel";

describe("ErrorPanel", () => {
  afterEach(() => {
    cleanup();
    useErrorStore.setState({ errors: [] });
  });

  it("大量错误只挂载视口附近的行", () => {
    useErrorStore.setState({
      errors: Array.from({ length: 300 }, (_, index) => ({
        type: ErrorTypeEnum.NodeNameRepeat,
        msg: `重复节点 ${index}`,
      })),
    });
    render(<ErrorPanel />);

    const mountedRows = document.querySelectorAll("[data-virtual-row-key]");
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThan(15);
  });
});
