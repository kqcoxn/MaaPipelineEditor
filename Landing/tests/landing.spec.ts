import { expect, test } from "@playwright/test";

test("hero CTAs and GitHub link point to the planned destinations", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("MaaPipelineEditor");

  await expect(page.getByTestId("hero-primary-cta")).toHaveAttribute("href", "/stable/");
  await expect(page.getByTestId("hero-secondary-cta")).toHaveAttribute("href", "/docs/");
  await expect(page.getByTestId("hero-github-cta")).toHaveAttribute(
    "href",
    "https://github.com/kqcoxn/MaaPipelineEditor",
  );
});

test("feature tabs switch content and support keyboard navigation", async ({ page }) => {
  await page.goto("/");

  const firstTab = page.getByTestId("feature-tab-review-edit");
  const secondTab = page.getByTestId("feature-tab-local-bridge");
  const fourthTab = page.getByTestId("feature-tab-ai-mcp");

  await firstTab.click();
  await firstTab.press("ArrowRight");
  await expect(secondTab).toHaveAttribute("aria-selected", "true");

  await fourthTab.click();
  await expect(fourthTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("feature-panel")).toContainText("AI Assist");
  await expect(page.getByTestId("feature-panel")).toContainText(
    "把节点搜索、补全与跨工具联动组织成可信的辅助层",
  );
});

test("mobile navigation opens, closes, and can reach anchor sections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.getByTestId("mobile-nav-toggle");
  await menuButton.press("Enter");
  await expect(page.getByTestId("mobile-nav-panel")).toBeVisible();

  await page
    .getByTestId("mobile-nav-panel")
    .getByRole("link", { name: "场景" })
    .click();
  await expect(page).toHaveURL(/#showcase$/);
  await expect(page.getByTestId("mobile-nav-panel")).toBeHidden();
});

test("desktop navigation reaches ecosystem anchor and header GitHub stays correct", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "生态", exact: true }).click();
  await expect(page).toHaveURL(/#ecosystem$/);
  await expect(page.getByTestId("header-github")).toHaveAttribute(
    "href",
    "https://github.com/kqcoxn/MaaPipelineEditor",
  );
});
