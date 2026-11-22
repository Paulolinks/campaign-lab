import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Key the scheduler sends to /api/internal/meta-sync. Derived from BETTER_AUTH_SECRET so the server needs no new
 * secret; the scheduler computes the same value with `sha256sum` (see compose.traefik.yaml).
 */
export function syncKey(): string {
  return createHash("sha256").update(`${env("BETTER_AUTH_SECRET")}:meta-sync`).digest("hex");
}
