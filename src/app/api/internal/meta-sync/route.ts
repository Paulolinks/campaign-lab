import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { syncKey } from "@/lib/meta-sync-key";
import { runScheduledSync } from "@/lib/meta-sync-service";

/**
 * Called by the `scheduler` container (compose.traefik.yaml): POST /api/internal/meta-sync?job=metrics|leads
 * with header x-sync-key. Answers at once and reads from Meta after the response.
 */
function validKey(given: string | null): boolean {
  const expected = Buffer.from(syncKey());
  const got = Buffer.from(given ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function POST(request: Request) {
  if (!validKey(request.headers.get("x-sync-key"))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const job = new URL(request.url).searchParams.get("job");
  if (job !== "metrics" && job !== "leads") return NextResponse.json({ error: "job deve ser metrics ou leads." }, { status: 400 });
  after(async () => {
    const result = await runScheduledSync(job);
    for (const r of result) if (!r.ok) console.warn(`[meta-sync] ${job} brand=${r.brandId}: ${r.message}`);
  });
  return NextResponse.json({ started: job }, { status: 202 });
}
