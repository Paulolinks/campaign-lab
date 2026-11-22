import { describe, expect, it } from "vitest";
import { campaignFunnel, nextAction } from "./campaign-funnel";

const base = { ads: 3, approved: 2, published: 2, spend: 12000, leads: 4, appointments: 1, won: 0 };

describe("campaignFunnel", () => {
  it("lists the six steps in order with their values", () => {
    const f = campaignFunnel(base);
    expect(f.steps.map((s) => s.value)).toEqual([3, 2, 2, 4, 1, 0]);
  });

  it("computes cost per lead and per booked visit, N/D (null) without denominator", () => {
    expect(campaignFunnel(base).costPerAppointment).toBe(12000);
    expect(campaignFunnel(base).costPerLead).toBe(3000);
    expect(campaignFunnel({ ...base, appointments: 0 }).costPerAppointment).toBeNull();
  });
});

describe("nextAction", () => {
  it("points to the first empty step", () => {
    expect(nextAction({ ...base, ads: 0 }).step).toBe("ads");
    expect(nextAction({ ...base, approved: 0 }).step).toBe("approved");
    expect(nextAction({ ...base, published: 0 }).step).toBe("published");
    expect(nextAction({ ...base, leads: 0 }).step).toBe("leads");
    expect(nextAction({ ...base, appointments: 0 }).step).toBe("appointments");
    expect(nextAction(base).step).toBe("won");
    expect(nextAction({ ...base, won: 1 }).step).toBeNull();
  });
});
