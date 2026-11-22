/**
 * Environment access. Read at call time (not import time) so `next build` works without secrets.
 * In development, missing values fall back to the local docker compose defaults (not secret).
 * In production every value is required.
 */
const DEV_DEFAULTS: Record<string, string> = {
  DATABASE_URL: "postgresql://campaignlab:campaignlab@127.0.0.1:5434/campaignlab",
  BETTER_AUTH_SECRET: "dev-only-secret-not-for-production-0123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
  MEDIA_DIR: "./.data/media",
  MAX_UPLOAD_MB: "500",
};

export function env(name: keyof typeof DEV_DEFAULTS): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return DEV_DEFAULTS[name];
  throw new Error(`Missing environment variable ${name}. See .env.example.`);
}

export const DEV_DATABASE_URL = DEV_DEFAULTS.DATABASE_URL;
