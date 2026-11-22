import { describe, expect, it } from "vitest";
import { addDays, dayInZone, daysBetween, oneRowPerAdDay, pickOneRowPerDay, summarizeAd, type AdLeadRow, type DailyRow } from "./ad-results";

const dayRow = (day: string, spendCents: number, extra: Partial<DailyRow> = {}): DailyRow => ({
  day, spendCents, impressions: 1000, reach: null, linkClicks: 10, platformLeads: null, ...extra,
});
const lead = (createdDay: string, appointmentDay: string | null = null, extra: Partial<AdLeadRow> = {}): AdLeadRow => ({
  createdDay, appointmentDay, isInProgress: appointmentDay === null, hasEstimateSent: false, isWon: false, revenueCents: 0, directCostsCents: 0, ...extra,
});

describe("day helpers", () => {
  it("counts whole days across month ends", () => {
    expect(daysBetween("2026-11-29", "2026-12-02")).toBe(3);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("uses the brand timezone for the calendar day", () => {
    // 02:00 UTC on Nov 22 is still Nov 21 in New York.
    expect(dayInZone(new Date("2026-11-22T02:00:00Z"), "America/New_York")).toBe("2026-11-21");
  });
});

describe("summarizeAd", () => {
  it("returns N/D ratios and no first day when there is no data", () => {
    const s = summarizeAd({ daily: [], leads: [], today: "2026-11-21", liveSince: null, endDay: null });
    expect(s.firstSpendDay).toBeNull();
    expect(s.total.cpl).toBeNull();
    expect(s.total.costPerAppointment).toBeNull();
    expect(s.total.linkCtr).toBeNull();
    expect(s.total.frequency).toBeNull();
  });

  it("sums the whole life and computes cost per appointment", () => {
    const s = summarizeAd({
      daily: [dayRow("2026-11-01", 2000), dayRow("2026-11-02", 2000), dayRow("2026-11-03", 2000)],
      leads: [lead("2026-11-02", "2026-11-03"), lead("2026-11-03")],
      today: "2026-11-03", liveSince: null, endDay: null,
    });
    expect(s.firstSpendDay).toBe("2026-11-01");
    expect(s.daysWithData).toBe(3);
    expect(s.total.spend).toBe(6000);
    expect(s.total.leads).toBe(2);
    expect(s.total.appointments).toBe(1);
    expect(s.total.leadsInProgress).toBe(1);
    expect(s.total.costPerAppointment).toBe(6000);
    expect(s.total.cpl).toBe(3000);
    expect(s.total.linkCtr).toBeCloseTo(0.01);
  });

  it("uses the Meta lead count when the CRM has fewer leads registered", () => {
    const s = summarizeAd({ daily: [dayRow("2026-11-01", 2000, { platformLeads: 3 })], leads: [lead("2026-11-01")], today: "2026-11-01", liveSince: null, endDay: null });
    expect(s.total.leads).toBe(3);
    expect(s.total.crmLeads).toBe(1);
  });

  it("last 7 days counts appointments booked in the window even for older leads", () => {
    const daily = Array.from({ length: 10 }, (_, i) => dayRow(addDays("2026-11-01", i), 2000));
    const s = summarizeAd({ daily, leads: [lead("2026-11-01", "2026-11-09")], today: "2026-11-10", liveSince: null, endDay: null });
    expect(s.last7.spend).toBe(7 * 2000);
    expect(s.last7.leads).toBe(0);
    expect(s.last7.appointments).toBe(1);
    expect(s.last7.costPerAppointment).toBe(14000);
  });

  it("spend since last appointment starts after the later of last visit and live-since", () => {
    const daily = Array.from({ length: 8 }, (_, i) => dayRow(addDays("2026-11-01", i), 2000));
    const visitAfterLive = summarizeAd({ daily, leads: [lead("2026-11-02", "2026-11-05")], today: "2026-11-08", liveSince: "2026-11-03", endDay: null });
    expect(visitAfterLive.spendSinceLastAppointment).toBe(3 * 2000); // Nov 6, 7, 8
    const noVisit = summarizeAd({ daily, leads: [], today: "2026-11-08", liveSince: "2026-11-03", endDay: null });
    expect(noVisit.spendSinceLastAppointment).toBe(5 * 2000); // Nov 4..8
  });

  it("frequency is the average of daily impressions/reach where reach was given", () => {
    const s = summarizeAd({
      daily: [dayRow("2026-11-01", 2000, { impressions: 300, reach: 100 }), dayRow("2026-11-02", 2000, { impressions: 200, reach: 100 }), dayRow("2026-11-03", 2000)],
      leads: [], today: "2026-11-03", liveSince: null, endDay: null,
    });
    expect(s.total.frequency).toBeCloseTo(2.5);
  });

  it("ignores days after the end day", () => {
    const s = summarizeAd({ daily: [dayRow("2026-11-01", 2000), dayRow("2026-11-05", 2000)], leads: [], today: "2026-11-10", liveSince: null, endDay: "2026-11-03" });
    expect(s.total.spend).toBe(2000);
    expect(s.lastDataDay).toBe("2026-11-01");
  });
});

describe("pickOneRowPerDay", () => {
  it("keeps one row per day, preferring API over CSV over Manual", () => {
    const rows = pickOneRowPerDay([
      { day: "2026-11-02", source: "MANUAL", v: 1 },
      { day: "2026-11-01", source: "MANUAL", v: 2 },
      { day: "2026-11-02", source: "CSV", v: 3 },
      { day: "2026-11-02", source: "META_API", v: 4 },
    ]);
    expect(rows.map((r) => r.v)).toEqual([2, 4]);
  });
});

describe("oneRowPerAdDay", () => {
  it("keeps the Meta row when Manual, CSV and Meta have the same ad and day, and keeps other ads apart", () => {
    const d = new Date("2026-11-20T00:00:00Z");
    const rows = oneRowPerAdDay([
      { publishedAdId: "a", date: d, source: "MANUAL", spend: "10" },
      { publishedAdId: "a", date: d, source: "CSV", spend: "11" },
      { publishedAdId: "a", date: d, source: "META_API", spend: "12" },
      { publishedAdId: "b", date: d, source: "MANUAL", spend: "5" },
    ]);
    expect(rows.map((r) => `${r.publishedAdId}:${r.source}`).sort()).toEqual(["a:META_API", "b:MANUAL"]);
  });
});
