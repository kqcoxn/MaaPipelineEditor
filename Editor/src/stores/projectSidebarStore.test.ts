import { beforeEach, describe, expect, it } from "vitest";

import {
  PROJECT_SIDEBAR_MAX_WIDTH,
  PROJECT_SIDEBAR_MIN_WIDTH,
  clampProjectSidebarWidth,
  shouldRenderProjectSidebar,
  useProjectSidebarStore,
} from "./projectSidebarStore";

describe("projectSidebarStore", () => {
  beforeEach(() => {
    useProjectSidebarStore.setState({ visible: true, width: 280 });
    localStorage.clear();
  });

  it("clamps pointer and keyboard width updates", () => {
    expect(clampProjectSidebarWidth(100)).toBe(PROJECT_SIDEBAR_MIN_WIDTH);
    expect(clampProjectSidebarWidth(999)).toBe(PROJECT_SIDEBAR_MAX_WIDTH);
    expect(clampProjectSidebarWidth(Number.NaN)).toBe(280);
  });

  it("persists visibility and width preferences", () => {
    useProjectSidebarStore.getState().setVisible(false);
    useProjectSidebarStore.getState().setWidth(360.4);

    const persisted = JSON.parse(
      localStorage.getItem("mpe.project-sidebar") ?? "{}",
    ) as { state?: { visible?: boolean; width?: number } };
    expect(persisted.state).toEqual({ visible: false, width: 360 });
  });

  it("sanitizes persisted width values during hydration", async () => {
    localStorage.setItem(
      "mpe.project-sidebar",
      JSON.stringify({ state: { visible: false, width: 900 }, version: 0 }),
    );

    await useProjectSidebarStore.persist.rehydrate();

    expect(useProjectSidebarStore.getState()).toMatchObject({
      visible: false,
      width: PROJECT_SIDEBAR_MAX_WIDTH,
    });
  });

  it("renders only for a connected non-embed editor", () => {
    expect(shouldRenderProjectSidebar(false, true, true)).toBe(true);
    expect(shouldRenderProjectSidebar(false, false, true)).toBe(false);
    expect(shouldRenderProjectSidebar(true, true, true)).toBe(false);
    expect(shouldRenderProjectSidebar(false, true, false)).toBe(false);
  });
});
