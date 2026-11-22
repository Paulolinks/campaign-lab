import { describe, expect, it } from "vitest";
import type { Evaluation, Verdict } from "./ad-decision";
import { scoreByAngle, todayPlan, type EvaluatedAd } from "./ad-today";

function ad(verdict: Verdict, extra: Partial<EvaluatedAd> = {}): EvaluatedAd {
  const phase: Evaluation["phase"] = verdict.startsWith("LIVE") ? "LIVE" : verdict === "ENDED" ? "ENDED" : "TESTING";
  return { angle: "QUALITY", phase, evaluation: { day: 3, phase, verdict, reasons: [], diagnosis: null, alerts: [] }, hasPassedTest: false, isCancelled: false, spend: 6000, appointments: 0, ...extra };
}

describe("todayPlan", () => {
  it("suggests creating a new ad when nothing is running", () => {
    expect(todayPlan([]).sentence).toContain("Nenhum anúncio rodando");
  });

  it("nothing to decide while tests are before day 3", () => {
    const p = todayPlan([ad("TESTING_DECIDE_DAY_3"), ad("LIVE_CONTINUE")]);
    expect(p.decide).toBe(0);
    expect(p.sentence).toContain("Nada para decidir hoje: 1 em teste e 1 vivo");
  });

  it("lists cancel, keep, stop and asks for a replacement ad", () => {
    const p = todayPlan([ad("TEST_FAILED_CANCEL"), ad("TEST_PASSED_KEEP"), ad("LIVE_STOP"), ad("LIVE_ATTENTION")]);
    expect(p.decide).toBe(2);
    expect(p.stop).toBe(1);
    expect(p.attention).toBe(1);
    expect(p.sentence).toContain("cancelar 1 teste sem resultado");
    expect(p.sentence).toContain("deixar vivo 1 que passou no teste");
    expect(p.sentence).toContain("parar 1 anúncio");
    expect(p.sentence).toContain("preparar um anúncio novo");
  });

  it("counts ads with alerts", () => {
    const withAlert = ad("LIVE_CONTINUE");
    withAlert.evaluation.alerts = ["CREATIVE_FATIGUE"];
    expect(todayPlan([withAlert]).alerts).toBe(1);
  });
});

describe("scoreByAngle", () => {
  it("groups by angle and ranks by cost per appointment, N/D last", () => {
    const rows = scoreByAngle([
      ad("ENDED", { angle: "PRICE", isCancelled: true, spend: 6000 }),
      ad("LIVE_CONTINUE", { angle: "QUALITY", hasPassedTest: true, spend: 20000, appointments: 2 }),
      ad("ENDED", { angle: "QUALITY", isCancelled: true, spend: 6000 }),
    ]);
    expect(rows.map((r) => r.angle)).toEqual(["QUALITY", "PRICE"]);
    expect(rows[0]).toMatchObject({ ads: 2, passed: 1, cancelled: 1, spend: 26000, appointments: 2, costPerAppointment: 13000 });
    expect(rows[1].costPerAppointment).toBeNull();
  });
});
