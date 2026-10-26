import { defineConfig, devices } from "@playwright/test";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  // Continuous trace writes can be locked by OneDrive while a test is closing.
  outputDir:
    process.env.PLAYWRIGHT_OUTPUT_DIR ||
    (process.platform === "win32"
      ? path.join(
          tmpdir(),
          "ballknowledge-playwright",
          createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12),
        )
      : "test-results"),
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" },
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    stderr: "ignore",
    stdout: "ignore",
  },
});
