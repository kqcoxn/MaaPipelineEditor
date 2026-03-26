import { defineConfig, devices } from "@playwright/test";

const previewCommand =
  process.platform === "win32"
    ? "yarn.cmd preview --host 127.0.0.1 --port 4321"
    : "yarn preview --host 127.0.0.1 --port 4321";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: previewCommand,
    port: 4321,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
