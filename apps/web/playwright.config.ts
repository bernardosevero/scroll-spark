import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Runs Next directly. A `pnpm` wrapper can keep the server's pipes open after tests finish, which
// is what hung CI.
const NEXT = "node node_modules/next/dist/bin/next";

export default defineConfig({
  testDir: "./e2e",
  globalTimeout: 5 * 60_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${NEXT} build && ${NEXT} start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 2_000 },
  },
});
