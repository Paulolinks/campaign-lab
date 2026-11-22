/**
 * "Veiculação" column of the manager, in the words of the Meta Ads Manager, from the internal state:
 * owner approval + whether the ad was published (linked by ID) and its life cycle.
 */
export type Delivery = { label: string; tone: "neutral" | "warn" | "ok" | "danger"; on: boolean };

export function adDelivery(approval: string, lifecycles: string[]): Delivery {
  if (lifecycles.includes("LIVE")) return { label: "No ar", tone: "ok", on: true };
  if (lifecycles.includes("TESTING")) return { label: "No ar · em teste", tone: "ok", on: true };
  if (lifecycles.length > 0) return { label: "Encerrado", tone: "neutral", on: false };
  if (approval === "APPROVED") return { label: "Aprovado · falta publicar", tone: "warn", on: false };
  if (approval === "REJECTED") return { label: "Rejeitado", tone: "danger", on: false };
  return { label: "Aguardando sua aprovação", tone: "warn", on: false };
}

/** A campaign or ad set shows the "best" delivery among its ads. */
export function groupDelivery(items: Delivery[]): Delivery {
  if (items.length === 0) return { label: "Sem anúncios", tone: "neutral", on: false };
  const order = ["No ar", "No ar · em teste", "Aprovado · falta publicar", "Aguardando sua aprovação", "Encerrado", "Rejeitado"];
  return [...items].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))[0];
}

/** Facebook cuts the primary text in the feed around 125 characters and adds "See more". */
export function feedTruncate(text: string, max = 125): { shown: string; cut: boolean } {
  const clean = text.trim();
  if (clean.length <= max) return { shown: clean, cut: false };
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return { shown: slice.slice(0, lastSpace > 80 ? lastSpace : max).trimEnd(), cut: true };
}
