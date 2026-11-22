import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build, on a throwaway database (campaignlab_e2e)
 * so the development database is never touched. Run: npm run test:e2e (resets that database first).
 */
const PORT = 3100;
const E2E_DATABASE_URL = "postgresql://campaignlab:campaignlab@127.0.0.1:5434/campaignlab_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      MEDIA_DIR: "./.data/e2e-media",
      MAX_UPLOAD_MB: "50",
    },
  },
});
