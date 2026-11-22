import { describe, expect, it } from "vitest";
import { adDelivery, feedTruncate, groupDelivery } from "./ad-delivery";

describe("adDelivery", () => {
  it("uses the publication first, then the approval", () => {
    expect(adDelivery("APPROVED", ["LIVE"]).label).toBe("No ar");
    expect(adDelivery("APPROVED", ["TESTING"]).on).toBe(true);
    expect(adDelivery("APPROVED", ["ENDED"]).label).toBe("Encerrado");
    expect(adDelivery("APPROVED", []).label).toBe("Aprovado · falta publicar");
    expect(adDelivery("REJECTED", []).tone).toBe("danger");
    expect(adDelivery("PENDING", []).label).toBe("Aguardando sua aprovação");
  });

  it("groups by the most advanced state", () => {
    expect(groupDelivery([adDelivery("PENDING", []), adDelivery("APPROVED", [])]).label).toBe("Aprovado · falta publicar");
    expect(groupDelivery([]).label).toBe("Sem anúncios");
  });
});

describe("feedTruncate", () => {
  it("keeps short text and cuts long text at a word", () => {
    expect(feedTruncate("Short text.")).toEqual({ shown: "Short text.", cut: false });
    const r = feedTruncate("word ".repeat(60));
    expect(r.cut).toBe(true);
    expect(r.shown.length).toBeLessThanOrEqual(125);
    expect(r.shown.endsWith("word")).toBe(true);
  });
});
