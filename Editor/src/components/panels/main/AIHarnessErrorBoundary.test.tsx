import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { XProvider } from "@ant-design/x";

import { AIHarnessErrorBoundary } from "./AIHarnessErrorBoundary";

function BrokenConversation(): never {
  throw new Error("Markdown render failed");
}

describe("AIHarnessErrorBoundary", () => {
  it("将对话渲染异常隔离在面板内", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <XProvider>
        <AIHarnessErrorBoundary>
          <BrokenConversation />
        </AIHarnessErrorBoundary>
      </XProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("对话内容渲染失败");
    expect(screen.getByRole("button", { name: /重新加载/ })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
