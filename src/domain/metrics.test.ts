import { describe, expect, it } from "vitest";
import { costPer, formatMoney, formatPercent, scorecard, toCents } from "./metrics";
import { buildUtmUrl } from "./utm";

const noMedia = { impressions: 0, linkClicks: 0 };

describe("scorecard", () => {
  it("returns null (N/D) for every ratio when there is no data", () => {
    const s = scorecard({ leads: 0, qualified: 0, appointments: 0, estimatesSent: 0, won: 0 }, { spend: 0, revenue: 0, directCosts: 0 }, noMedia);
    expect(s.cpl).toBeNull();
    expect(s.cpql).toBeNull();
    expect(s.cac).toBeNull();
    expect(s.closeRate).toBeNull();
    expect(s.grossMargin).toBeNull();
    expect(s.roas).toBeNull();
    expect(s.contributionAfterMedia).toBeNull();
    expect(formatMoney(s.cpl)).toBe("N/D");
  });

  it("spend with zero leads: CPL is N/D, not 0", () => {
    const s = scorecard({ leads: 0, qualified: 0, appointments: 0, estimatesSent: 0, won: 0 }, { spend: 10000, revenue: 0, directCosts: 0 }, noMedia);
    expect(s.cpl).toBeNull();
    expect(s.contributionAfterMedia).toBe(-10000);
  });

  it("computes CPL, CPQL, CAC, margin and contribution after media", () => {
    const s = scorecard(
      { leads: 18, qualified: 8, appointments: 6, estimatesSent: 4, won: 2 },
      { spend: toCents("284"), revenue: toCents("6200"), directCosts: toCents("4100") },
      { impressions: 8400, linkClicks: 154 },
    );
    expect(s.cpl).toBe(1578); // $15.78
    expect(s.cpql).toBe(3550); // $35.50
    expect(s.cac).toBe(14200); // $142
    expect(s.closeRate).toBe(0.5);
    expect(s.contributionAfterMedia).toBe(toCents("1816"));
    expect(s.grossMargin).toBeCloseTo(2100 / 6200);
    expect(s.cpm).toBe(3381);
    expect(formatPercent(s.qualificationRate)).toBe("44.4%");
  });
});

describe("money helpers", () => {
  it("toCents avoids float drift", () => {
    expect(toCents("0.1") + toCents("0.2")).toBe(30);
    expect(toCents(null)).toBe(0);
  });
  it("costPer returns null without denominator", () => {
    expect(costPer(500, 0)).toBeNull();
  });
});

describe("buildUtmUrl", () => {
  it("adds UTM params", () => {
    const url = buildUtmUrl("https://example.com/estimate", { source: "facebook", medium: "paid_social", campaign: "CS MS Quality 2026-11", content: "A01", id: "CS-MS-Q-2611" });
    expect(url).toBe("https://example.com/estimate?utm_source=facebook&utm_medium=paid_social&utm_campaign=cs_ms_quality_2026_11&utm_content=a01&utm_id=cs-ms-q-2611");
  });
  it("returns null for template URLs", () => {
    expect(buildUtmUrl("{{BRAND_ESTIMATE_URL}}", { source: "f", medium: "m", campaign: "c" })).toBeNull();
  });
});
