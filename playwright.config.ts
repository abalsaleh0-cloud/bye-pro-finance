import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "mobile-ar", use: { ...devices["Pixel 7"], locale: "ar-SA" } },
    { name: "tablet-ar", use: { ...devices["iPad (gen 7)"], locale: "ar-SA" } },
    { name: "desktop-ar", use: { viewport: { width: 1440, height: 900 }, locale: "ar-SA" } },
    { name: "mobile-en", use: { ...devices["Pixel 7"], locale: "en-US" } },
    { name: "tablet-en", use: { ...devices["iPad (gen 7)"], locale: "en-US" } },
    { name: "desktop-en", use: { viewport: { width: 1440, height: 900 }, locale: "en-US" } },
  ],
  webServer: {
    command: "pnpm --filter @bye-pro-finance/web preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
