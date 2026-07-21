import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WelcomeScreen } from "./WelcomeScreen";

describe("WelcomeScreen", () => {
  afterEach(cleanup);

  it("renders the primary documentation links", () => {
    render(<WelcomeScreen />);

    expect(screen.getByRole("link", { name: /MPE 快速上手/ })).toHaveAttribute(
      "href",
      "https://mpe.codax.site/docs/guide/start/quick-start.html",
    );
    expect(screen.getByRole("link", { name: /Pipeline 协议/ })).toHaveAttribute(
      "href",
      "https://maafw.com/docs/3.1-PipelineProtocol.html",
    );
  });
});
