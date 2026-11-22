import { describe, expect, it } from "vitest";
import {
  addDays,
  budgetFromMinor,
  classifyMetaError,
  dayChunks,
  deliveryOf,
  insightNumbers,
  leadsFromActions,
  oldestAllowedDay,
  periodMetrics,
  suggestVariant,
  syncWindow,
  targetingSummary,
} from "./meta-sync";

describe("budgetFromMinor", () => {
  it("converts cents to dollars", () => expect(budgetFromMinor("2000", "USD")).toBe("20.00"));
  it("keeps whole units for currencies without cents", () => expect(budgetFromMinor("1500", "JPY")).toBe("1500.00"));
  it("returns null for missing or zero budgets", () => {
    expect(budgetFromMinor(undefined, "USD")).toBeNull();
    expect(budgetFromMinor("0", "USD")).toBeNull();
  });
});

describe("leadsFromActions", () => {
  it("uses the aggregated lead action and never sums it with form leads", () => {
    expect(leadsFromActions([{ action_type: "onsite_conversion.lead_grouped", value: "3" }, { action_type: "lead", value: "4" }])).toBe(4);
  });
  it("falls back to form leads when the aggregated action is missing", () => {
    expect(leadsFromActions([{ action_type: "onsite_conversion.lead_grouped", value: "2" }])).toBe(2);
  });
  it("returns null when there are no lead actions", () => {
    expect(leadsFromActions([{ action_type: "link_click", value: "9" }])).toBeNull();
    expect(leadsFromActions(undefined)).toBeNull();
  });
});

describe("insightNumbers", () => {
  it("parses Meta strings into numbers", () => {
    const n = insightNumbers({ spend: "19.5", impressions: "1200", reach: "900", frequency: "1.33", clicks: "40", inline_link_clicks: "25", actions: [{ action_type: "lead", value: "2" }] });
    expect(n).toEqual({ spend: "19.50", impressions: 1200, reach: 900, frequency: 1.33, clicks: 40, linkClicks: 25, leads: 2 });
  });
  it("treats missing counts as unknown, not zero", () => {
    const n = insightNumbers({ spend: "0" });
    expect(n.reach).toBeNull();
    expect(n.linkClicks).toBeNull();
    expect(n.impressions).toBe(0);
  });
});

describe("date windows", () => {
  it("adds days across months", () => expect(addDays("2026-02-27", 3)).toBe("2026-03-02"));
  it("stops one day after the 37-month limit", () => expect(oldestAllowedDay("2026-11-22")).toBe("2023-10-23"));
  it("full sync reads all history, incremental only the last 7 days", () => {
    expect(syncWindow("FULL", "2026-11-22")).toEqual({ since: "2023-10-23", until: "2026-11-22" });
    expect(syncWindow("INCREMENTAL", "2026-11-22")).toEqual({ since: "2026-11-16", until: "2026-11-22" });
  });
  it("splits a range into blocks of 30 days without gaps or overlaps", () => {
    const chunks = dayChunks("2026-01-01", "2026-03-05");
    expect(chunks).toEqual([
      { since: "2026-01-01", until: "2026-01-30" },
      { since: "2026-01-31", until: "2026-03-01" },
      { since: "2026-03-02", until: "2026-03-05" },
    ]);
  });
  it("returns one block when the range is a single day", () => expect(dayChunks("2026-11-22", "2026-11-22")).toEqual([{ since: "2026-11-22", until: "2026-11-22" }]));
});

describe("classifyMetaError", () => {
  it("recognizes rate limits", () => {
    expect(classifyMetaError(17)).toBe("RATE_LIMIT");
    expect(classifyMetaError(80004)).toBe("RATE_LIMIT");
  });
  it("recognizes an expired or invalid token", () => expect(classifyMetaError(190)).toBe("AUTH"));
  it("recognizes a missing permission", () => {
    expect(classifyMetaError(10)).toBe("PERMISSION");
    expect(classifyMetaError(200)).toBe("PERMISSION");
  });
  it("leaves anything else as other", () => {
    expect(classifyMetaError(100)).toBe("OTHER");
    expect(classifyMetaError(undefined)).toBe("OTHER");
  });
});

describe("targetingSummary", () => {
  it("shows place with radius and age range", () => {
    expect(targetingSummary({ age_min: 30, age_max: 65, geo_locations: { cities: [{ name: "Marietta", radius: 35, distance_unit: "mile" }] } })).toBe("Marietta (+35 mi) · 30–65");
  });
  it("shortens long place lists", () => {
    expect(targetingSummary({ geo_locations: { zips: [{ name: "30060" }, { name: "30062" }, { name: "30064" }, { name: "30066" }] } })).toBe("30060, 30062, 30064 +1");
  });
  it("returns null when there is nothing to show", () => expect(targetingSummary({})).toBeNull());
});

describe("suggestVariant", () => {
  const variants = [{ id: "v1", adKey: "A01" }, { id: "v2", adKey: "B01" }, { id: "v3", adKey: "A010" }];
  it("finds the variant whose code is in the ad name", () => expect(suggestVariant("A01 - Two HVAC Quotes", variants)?.id).toBe("v1"));
  it("does not match a code inside a longer code", () => expect(suggestVariant("Teste A010", variants)?.id).toBe("v3"));
  it("does not guess when two codes appear", () => expect(suggestVariant("A01 vs B01", variants)).toBeNull());
  it("returns null without a code", () => expect(suggestVariant("Winter heating", variants)).toBeNull());
  it("matches the full key, or its short code when only one variant has it", () => {
    const long = [{ id: "x", adKey: "CS-MS-QUALITY-2026-11-A01" }, { id: "y", adKey: "CS-MS-QUALITY-2026-11-B01" }];
    expect(suggestVariant("CS-MS-QUALITY-2026-11-A01 | heat", long)?.id).toBe("x");
    expect(suggestVariant("A01 - Two quotes", long)?.id).toBe("x");
    expect(suggestVariant("A01 - Two quotes", [...long, { id: "z", adKey: "CS-HP-2026-12-A01" }])).toBeNull();
  });
});

describe("deliveryOf", () => {
  it("maps active and paused", () => {
    expect(deliveryOf("ACTIVE")).toMatchObject({ label: "Ativo", on: true });
    expect(deliveryOf("CAMPAIGN_PAUSED")).toMatchObject({ on: false });
  });
});

describe("periodMetrics", () => {
  it("computes cost per result, CPM, CPC and CTR", () => {
    expect(periodMetrics({ spendCents: 4000, impressions: 2000, clicks: 50, linkClicks: 20, leads: 4 })).toEqual({ costPerResultCents: 1000, cpmCents: 2000, cpcCents: 200, ctr: 0.025 });
  });
  it("returns null when there is no denominator", () => {
    expect(periodMetrics({ spendCents: 4000, impressions: 0, clicks: null, linkClicks: 0, leads: null })).toEqual({ costPerResultCents: null, cpmCents: null, cpcCents: null, ctr: null });
  });
});
