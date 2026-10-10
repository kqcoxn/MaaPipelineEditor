import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
          absPath: "D:/project/image/templates/button.png",
        },
        pending: false,
      },
    ],
  }),
}));

import { NodeTemplateImages } from "./NodeTemplateImages";

afterEach(cleanup);
describe("NodeTemplateImages", () => {
  it("uses the cached image URL and prevents React Flow node dragging", () => {
    render(<NodeTemplateImages templatePaths={["templates/button.png"]} />);

    const image = screen.getByAltText("templates/button.png");
    expect(image.closest(".nodrag")).toBeTruthy();
    expect(image).toHaveAttribute("src", "blob:test");
  });
});

it("opens the template editor and closes without propagating gestures to the node", async () => {
  const drag = vi.fn();
  render(
    <div onMouseDown={drag} onPointerDown={drag}>
      <NodeTemplateImages templatePaths={["templates/button.png"]} />
    </div>,
  );
  const button = screen.getByRole("button", {
    name: "编辑模板 templates/button.png",
  });
  fireEvent.mouseDown(button);
  fireEvent.click(button);
  const dialog = await screen.findByRole("dialog");
  expect(screen.getByText("模板图片编辑")).toBeInTheDocument();
  expect(screen.queryByText("暂无 ROI")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存到原文件" })).toBeDisabled();
  fireEvent.mouseDown(dialog);
  expect(drag).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  await waitFor(() => {
    const closing = screen.queryByRole("dialog");
    if (closing) fireEvent.animationEnd(closing);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  fireEvent.click(button);
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
