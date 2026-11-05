import { defineConfig, devices } from "@playwright/test";

// No Windows usa o Edge já instalado; no CI usa o Chromium do Playwright.
const channel = process.platform === "win32" ? "msedge" : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    viewport: { width: 375, height: 812 },
    channel,
  },
  webServer: {
    command: "npx tsx tests/e2e/support/stack.ts",
    url: "http://localhost:3100/login",
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
