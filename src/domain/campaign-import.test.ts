import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AD_CONTENT_KEYS, buildImportPlan, parseBudget, type ExistingVariant } from "./campaign-import";

const example = readFileSync("context/reference/02_EXEMPLO_CAMPANHA_IMPORTAVEL.txt", "utf8");

function plan(existing: ExistingVariant[] = [], forbiddenTerms: string[] = []) {
  return buildImportPlan({
    text: example,
    brandName: "Cool Season",
    forbiddenTerms,
    existingCampaignKeys: existing.length ? ["CS-MS-QUALITY-2026-11"] : [],
    existingVariants: existing,
  });
}

describe("buildImportPlan", () => {
  it("plans 1 campaign and 3 new ads on first import", () => {
    const p = plan();
    expect(p.ok).toBe(true);
    expect(p.totals).toEqual({ campaigns: 1, ads: 3, create: 3, update: 0, unchanged: 0 });
    const c = p.campaigns[0].input;
    expect(c.channels).toEqual(["META_PAID", "FACEBOOK_ORGANIC"]);
    expect(c.budgetPerDay).toBeNull();
    expect(c.budgetNote).toBe("TBD");
  });

  it("re-importing the same content marks every ad unchanged (no duplicates)", () => {
    const first = plan();
    const existing: ExistingVariant[] = first.campaigns[0].ads.map((a) => ({
      adKey: a.input.adKey,
      campaignKey: "CS-MS-QUALITY-2026-11",
      ...Object.fromEntries(AD_CONTENT_KEYS.map((k) => [k, a.input[k]])),
    })) as ExistingVariant[];
    const again = plan(existing);
    expect(again.totals).toMatchObject({ create: 0, update: 0, unchanged: 3 });
    expect(again.campaigns[0].exists).toBe(true);
  });

  it("detects a changed headline as an update and names the field", () => {
    const first = plan();
    const existing = first.campaigns[0].ads.map((a, i) => ({
      adKey: a.input.adKey,
      campaignKey: "CS-MS-QUALITY-2026-11",
      ...Object.fromEntries(AD_CONTENT_KEYS.map((k) => [k, a.input[k]])),
      ...(i === 0 ? { headline: "Old headline" } : {}),
    })) as ExistingVariant[];
    const p = plan(existing);
    expect(p.campaigns[0].ads[0]).toMatchObject({ change: "update", changedFields: ["headline"] });
  });

  it("blocks an AD_KEY that already belongs to another campaign", () => {
    const first = plan();
    const a = first.campaigns[0].ads[0].input;
    const existing = [{ ...a, campaignKey: "OTHER" }] as unknown as ExistingVariant[];
    const p = buildImportPlan({ text: example, brandName: "Cool Season", forbiddenTerms: [], existingCampaignKeys: [], existingVariants: existing });
    expect(p.ok).toBe(false);
    expect(p.errors[0].message).toMatch(/já existe nesta marca na campanha OTHER/);
  });

  it("warns when ad copy uses a term forbidden for the brand", () => {
    const p = plan([], ["warranty"]);
    expect(p.campaigns[0].ads[1].warnings[0]).toMatch(/termo proibido/);
  });

  it("warns when BRAND in the file differs from the selected brand", () => {
    const p = buildImportPlan({ text: example, brandName: "Other Co", forbiddenTerms: [], existingCampaignKeys: [], existingVariants: [] });
    expect(p.warnings[0]).toMatch(/diferente da marca selecionada/);
  });
});

describe("parseBudget", () => {
  it.each([
    ["25", "25.00"],
    ["$25.5", "25.50"],
    ["1,200", "1200.00"],
  ])("parses %s", (input, expected) => {
    expect(parseBudget(input)).toEqual({ amount: expected, note: null });
  });

  it("keeps non-numeric text as a note", () => {
    expect(parseBudget("TBD")).toEqual({ amount: null, note: "TBD" });
  });
});
