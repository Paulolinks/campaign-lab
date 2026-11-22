import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, diagnose, evaluateAd, parseRules, type AdState, type BrandTargets } from "./ad-decision";
import { addDays, summarizeAd, type AdLeadRow, type DailyRow } from "./ad-results";

const START = "2026-11-01";
const brand: BrandTargets = { currency: "USD", adDailyBudgetCents: 2000, targetCostPerAppointmentCents: 12000, maxDailySpendCents: 4000, activeAdsCount: 1 };

function days(n: number, extra: Partial<DailyRow> = {}): DailyRow[] {
  return Array.from({ length: n }, (_, i) => ({ day: addDays(START, i), spendCents: 2000, impressions: 1500, reach: null, linkClicks: 30, platformLeads: null, ...extra }));
}
const lead = (createdDay: string, appointmentDay: string | null = null): AdLeadRow => ({
  createdDay, appointmentDay, isInProgress: appointmentDay === null, hasEstimateSent: false, isWon: false, revenueCents: 0, directCostsCents: 0,
});

function run(opts: { daily: DailyRow[]; leads?: AdLeadRow[]; today: string; phase?: AdState["phase"]; liveSince?: string | null; brand?: Partial<BrandTargets> }) {
  const s = summarizeAd({ daily: opts.daily, leads: opts.leads ?? [], today: opts.today, liveSince: opts.liveSince ?? null, endDay: null });
  const state: AdState = { phase: opts.phase ?? "TESTING", maxDaySpendCents: Math.max(0, ...opts.daily.map((d) => d.spendCents)) };
  return evaluateAd(s, state, { ...brand, ...opts.brand }, DEFAULT_RULES, opts.today);
}

describe("test phase (days 1–3)", () => {
  it("not started without spend", () => {
    expect(run({ daily: [], today: START }).verdict).toBe("NOT_STARTED");
  });

  it("days 1 and 2 wait for the decision day", () => {
    const e = run({ daily: days(2), today: addDays(START, 1) });
    expect(e.day).toBe(2);
    expect(e.verdict).toBe("TESTING_DECIDE_DAY_3");
  });

  it("day 3 with 2 leads (boundary) passes", () => {
    const e = run({ daily: days(3), leads: [lead(START), lead(START)], today: addDays(START, 2) });
    expect(e.day).toBe(3);
    expect(e.verdict).toBe("TEST_PASSED_KEEP");
  });

  it("day 3 with 1 appointment (boundary) passes even with a single lead", () => {
    expect(run({ daily: days(3), leads: [lead(START, addDays(START, 1))], today: addDays(START, 2) }).verdict).toBe("TEST_PASSED_KEEP");
  });

  it("day 3 with 1 lead and no appointment fails with a diagnosis", () => {
    const e = run({ daily: days(3), leads: [lead(START)], today: addDays(START, 2) });
    expect(e.verdict).toBe("TEST_FAILED_CANCEL");
    expect(e.reasons.join(" ")).toContain("$60.00");
  });

  it("day counts by calendar even when a day has no metric", () => {
    const e = run({ daily: [days(1)[0]], today: addDays(START, 2) });
    expect(e.day).toBe(3);
    expect(e.verdict).toBe("TEST_FAILED_CANCEL");
  });
});

describe("live phase", () => {
  const liveSince = addDays(START, 2);

  it("continues while spend since last visit is under the target", () => {
    const e = run({ daily: days(6), leads: [lead(START, addDays(START, 3))], today: addDays(START, 5), phase: "LIVE", liveSince });
    expect(e.verdict).toBe("LIVE_CONTINUE");
  });

  it("attention at exactly 1× the target without a new visit (boundary)", () => {
    // live since day 3; days 4..9 = 6 × $20 = $120
    const e = run({ daily: days(9), today: addDays(START, 8), phase: "LIVE", liveSince });
    expect(e.verdict).toBe("LIVE_ATTENTION");
  });

  it("stops at exactly 1.5× the target without a new visit (boundary)", () => {
    // days 4..12 = 9 × $20 = $180
    const e = run({ daily: days(12), today: addDays(START, 11), phase: "LIVE", liveSince });
    expect(e.verdict).toBe("LIVE_STOP");
    expect(e.reasons[0]).toContain("$180.00");
  });

  it("attention when last-7-day cost per visit is above the target", () => {
    const e = run({ daily: days(9, { spendCents: 13000 }), leads: [lead(START, addDays(START, 8))], today: addDays(START, 8), phase: "LIVE", liveSince });
    expect(e.verdict).toBe("LIVE_ATTENTION");
    expect(e.reasons[0]).toContain("7 dias");
  });

  it("without a target the live ad is NO_TARGET", () => {
    expect(run({ daily: days(5), today: addDays(START, 4), phase: "LIVE", liveSince, brand: { targetCostPerAppointmentCents: null } }).verdict).toBe("NO_TARGET");
  });

  it("creative fatigue alert only above frequency 3", () => {
    const at3 = run({ daily: days(5, { impressions: 300, reach: 100 }), leads: [lead(START, addDays(START, 4))], today: addDays(START, 4), phase: "LIVE", liveSince });
    expect(at3.alerts).not.toContain("CREATIVE_FATIGUE");
    const above = run({ daily: days(5, { impressions: 301, reach: 100 }), leads: [lead(START, addDays(START, 4))], today: addDays(START, 4), phase: "LIVE", liveSince });
    expect(above.alerts).toContain("CREATIVE_FATIGUE");
  });
});

describe("alerts", () => {
  it("overspend only above budget + 25%", () => {
    expect(run({ daily: days(1, { spendCents: 2500 }), today: START }).alerts).not.toContain("OVERSPEND_DAY");
    expect(run({ daily: days(1, { spendCents: 2501 }), today: START }).alerts).toContain("OVERSPEND_DAY");
  });

  it("brand cap only when active ads × budget exceed the max daily spend", () => {
    expect(run({ daily: days(1), today: START, brand: { activeAdsCount: 2 } }).alerts).not.toContain("BRAND_CAP_EXCEEDED");
    expect(run({ daily: days(1), today: START, brand: { activeAdsCount: 3 } }).alerts).toContain("BRAND_CAP_EXCEEDED");
  });

  it("ended ads have no alerts and keep a diagnosis when they never booked a visit", () => {
    const s = summarizeAd({ daily: days(3, { linkClicks: 5 }), leads: [], today: addDays(START, 5), liveSince: null, endDay: addDays(START, 2) });
    const e = evaluateAd(s, { phase: "ENDED", maxDaySpendCents: 9999 }, brand, DEFAULT_RULES, addDays(START, 5));
    expect(e.verdict).toBe("ENDED");
    expect(e.alerts).toEqual([]);
    expect(e.diagnosis?.stage).toBe("ATTENTION");
  });
});

describe("diagnose (first blocked stage)", () => {
  const summary = (d: Partial<DailyRow>, leads: AdLeadRow[] = []) => summarizeAd({ daily: days(3, d), leads, today: addDays(START, 2), liveSince: null, endDay: null });

  it("no media data", () => {
    expect(diagnose(summary({ impressions: 0 }), DEFAULT_RULES, "USD")?.stage).toBe("NO_MEDIA_DATA");
  });
  it("delivery when impressions are under 1,000", () => {
    expect(diagnose(summary({ impressions: 300 }), DEFAULT_RULES, "USD")?.stage).toBe("DELIVERY");
  });
  it("attention when CTR is under 1%", () => {
    expect(diagnose(summary({ linkClicks: 10 }), DEFAULT_RULES, "USD")?.stage).toBe("ATTENTION"); // 30 / 4500
  });
  it("CTR of exactly 1% is not an attention problem", () => {
    expect(diagnose(summary({ impressions: 1000, linkClicks: 10 }), DEFAULT_RULES, "USD")?.stage).toBe("CONVERSION");
  });
  it("conversion when 15+ clicks and no lead", () => {
    expect(diagnose(summary({ linkClicks: 5 * 3 }), { ...DEFAULT_RULES, diagMinLinkCtr: 0 }, "USD")?.stage).toBe("CONVERSION");
  });
  it("lead quality when 2+ leads and no visit", () => {
    expect(diagnose(summary({}, [lead(START), lead(START)]), DEFAULT_RULES, "USD")?.stage).toBe("LEAD_QUALITY");
  });
  it("skips click stages when clicks were never recorded", () => {
    expect(diagnose(summary({ linkClicks: null }), DEFAULT_RULES, "USD")).toBeNull();
  });
});

describe("parseRules", () => {
  it("fills defaults and falls back on invalid JSON", () => {
    expect(parseRules(null)).toEqual(DEFAULT_RULES);
    expect(parseRules({ decisionDay: 4 }).decisionDay).toBe(4);
    expect(parseRules({ decisionDay: "x" })).toEqual(DEFAULT_RULES);
  });
});
