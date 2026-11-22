import { describe, expect, it } from "vitest";
import { aggregate, type LeadRow } from "./dashboard";

const lead = (over: Partial<LeadRow> = {}): LeadRow => ({ status: "NEW", history: ["NEW"], variantAngle: null, hasSource: true, estimates: [], jobs: [], ...over });

describe("aggregate", () => {
  it("is all N/D with no data", () => {
    const r = aggregate([], []);
    expect(r.card.cpl).toBeNull();
    expect(r.card.cpql).toBeNull();
    expect(r.card.contributionAfterMedia).toBeNull();
    expect(r.byAngle).toEqual([]);
  });

  it("counts a lead that was qualified and then lost as qualified", () => {
    const r = aggregate([lead({ status: "LOST", history: ["NEW", "QUALIFIED", "LOST"] })], []);
    expect(r.funnel.qualified).toBe(1);
    expect(r.funnel.won).toBe(0);
  });

  it("does not count a lead lost straight from NEW as qualified", () => {
    expect(aggregate([lead({ status: "LOST", history: ["NEW", "LOST"] })], []).funnel.qualified).toBe(0);
  });

  it("moving a lead through stages keeps it as one lead", () => {
    const r = aggregate([lead({ status: "WON", history: ["NEW", "QUALIFIED", "ESTIMATE_SENT", "WON"], jobs: [{ contractAmount: "3100", directCosts: "2000" }] })], []);
    expect(r.funnel).toEqual({ leads: 1, qualified: 1, appointments: 1, estimatesSent: 1, won: 1 });
    expect(r.card.revenue).toBe(310000);
    expect(r.card.grossMargin).toBeCloseTo(1100 / 3100);
  });

  it("compares angles by CPQL with spend from linked ads", () => {
    const r = aggregate(
      [
        lead({ variantAngle: "QUALITY", status: "QUALIFIED", history: ["NEW", "QUALIFIED"] }),
        lead({ variantAngle: "QUALITY" }),
        lead({ variantAngle: "PRICE" }),
      ],
      [
        { spend: "100", impressions: 1000, linkClicks: 10, variantAngle: "QUALITY" },
        { spend: "80", impressions: 900, linkClicks: 12, variantAngle: "PRICE" },
      ],
    );
    expect(r.byAngle[0]).toMatchObject({ angle: "QUALITY", spend: 10000, leads: 2, qualified: 1, cpql: 10000 });
    expect(r.byAngle[1]).toMatchObject({ angle: "PRICE", qualified: 0, cpql: null });
  });

  it("counts leads without source for the data-quality panel", () => {
    expect(aggregate([lead({ hasSource: false }), lead()], []).leadsWithoutSource).toBe(1);
  });
});
