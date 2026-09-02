import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("antd", () => ({
  Image: ({
    alt,
    fallback,
    preview,
  }: {
    alt?: string;
    fallback?: string;
    preview?: { src?: string };
  }) => (
    <img
      data-testid="template-image"
      data-fallback={fallback}
      data-preview-src={preview?.src}
      alt={alt}
    />
  ),
  Spin: () => null,
}));

vi.mock("@/hooks/useResourceImages", () => ({
  useResourceImages: () => ({
    connected: true,
    paths: ["templates/button.png"],
    images: [
      {
        path: "templates/button.png",
        image: {
          width: 32,
          height: 32,
          url: "blob:test",
          dataUrl: "data:image/png;base64,test",
        },
        pending: false,
      },
    ],
  }),
}));

import { NodeTemplateImages } from "./NodeTemplateImages";

describe("NodeTemplateImages", () => {
  it("prevents React Flow from treating image preview clicks as node drags", () => {
    render(<NodeTemplateImages templatePaths={["templates/button.png"]} />);

    const image = screen.getByTestId("template-image");
    expect(image.closest(".nodrag")).toBeTruthy();
    expect(image).toHaveAttribute(
      "data-fallback",
      "data:image/png;base64,test",
    );
    expect(image).toHaveAttribute(
      "data-preview-src",
      "data:image/png;base64,test",
    );
  });
});
