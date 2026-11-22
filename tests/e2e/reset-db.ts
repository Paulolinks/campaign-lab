import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import pg from "pg";
const E2E_DATABASE_URL = "postgresql://campaignlab:campaignlab@127.0.0.1:5434/campaignlab_e2e";

/** Wipes ONLY the e2e database (name must end in _e2e) and applies migrations. Run before Playwright starts the server. */
async function resetE2eDatabase() {
  const dbName = new URL(E2E_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_e2e")) throw new Error(`Refusing to reset non-test database "${dbName}".`);
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL } });
  rmSync(".data/e2e-media", { recursive: true, force: true });
}

await resetE2eDatabase();
