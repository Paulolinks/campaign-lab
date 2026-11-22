import { describe, expect, it } from "vitest";
import { buildAiTemplate, EXAMPLE_BLOCK, stripCodeFence } from "./ai-template";
import { buildImportPlan } from "./campaign-import";
import { parseCscamp } from "./cscamp-parser";

const brand = {
  name: "Cool Season",
  industry: "HVAC",
  serviceArea: "Atlanta, GA",
  forbiddenTerms: ["financing", "0% APR"],
  persona: { name: "The Careful Homeowner", content: "Persona text here." },
};

describe("buildAiTemplate", () => {
  const text = buildAiTemplate(brand);

  it("is personalized with brand, persona, forbidden terms and persona text", () => {
    expect(text).toContain('para a marca "Cool Season"');
    expect(text).toContain("PERSONA: The Careful Homeowner");
    expect(text).toContain("- financing\n- 0% APR");
    expect(text).toContain("Persona text here.");
  });

  it("lists every required field the importer checks", () => {
    for (const f of ["CAMPAIGN_KEY", "TEST_HYPOTHESIS", "LANDING_URL", "AD_KEY", "FUNNEL_STAGE", "VISUAL_DIRECTION"]) expect(text).toContain(f);
  });

  it("works for a brand without persona or forbidden terms", () => {
    const t = buildAiTemplate({ ...brand, persona: null, forbiddenTerms: [], industry: null, serviceArea: null });
    expect(t).toContain("ainda não tem persona cadastrada");
    expect(t).toContain("nenhum termo cadastrado");
  });

  it("its example imports with no errors and lands in the right fields", () => {
    const example = EXAMPLE_BLOCK.replace("{{BRAND}}", "Cool Season").replace("{{PERSONA}}", "The Careful Homeowner");
    const plan = buildImportPlan({ text: example, brandName: "Cool Season", forbiddenTerms: [], existingCampaignKeys: [], existingVariants: [] });
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    const ad = plan.campaigns[0].ads[0].input;
    expect(ad.headline).toBe("Short headline");
    expect(ad.videoScript).toContain("SCENE 04 | CTA");
    expect(plan.campaigns[0].input.channels).toEqual(["META_PAID", "INSTAGRAM_ORGANIC"]);
  });
});

describe("stripCodeFence", () => {
  it("removes ```txt fences the AI adds around its answer", () => {
    const answer = "```txt\nCSCAMP/1\nCAMPAIGN\n```\n\n";
    expect(stripCodeFence(answer)).toBe("CSCAMP/1\nCAMPAIGN");
    expect(parseCscamp(stripCodeFence("```\n" + EXAMPLE_BLOCK + "\n```")).errors).toEqual([]);
  });

  it("leaves plain text untouched", () => {
    expect(stripCodeFence("CSCAMP/1\nX")).toBe("CSCAMP/1\nX");
  });
});
