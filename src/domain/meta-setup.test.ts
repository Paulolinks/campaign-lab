import { describe, expect, it } from "vitest";
import { adSetSetup, adSetup, asExtra, CAMPAIGN_SETUP_KEYS, campaignSetup, listItems, otherExtra } from "./meta-setup";

describe("listItems", () => {
  it("splits by line, middle dot or semicolon and drops bullets", () => {
    expect(listItems("- Make image A\n2. Upload it\n\n• Approve")).toEqual(["Make image A", "Upload it", "Approve"]);
    expect(listItems("Which room? · ZIP; Name")).toEqual(["Which room?", "ZIP", "Name"]);
  });
  it("returns an empty list for nothing", () => {
    expect(listItems(null)).toEqual([]);
    expect(listItems("  ")).toEqual([]);
  });
});

describe("campaignSetup", () => {
  it("shows the fields present, in Meta order", () => {
    const r = campaignSetup({ META_STATUS: "Pausada", META_OBJECTIVE: "Cadastros", META_CAMPAIGN_NAME: "CS_X" }, null);
    expect(r.map((x) => x.label)).toEqual(["Nome da campanha", "Objetivo", "Status ao criar"]);
  });
  it("fills the objective from the CTA destination when missing", () => {
    expect(campaignSetup({ META_CAMPAIGN_NAME: "CS_X" }, "META_INSTANT_FORM")[1]).toMatchObject({ label: "Objetivo", value: "Cadastros (Leads) · formulário instantâneo" });
    expect(campaignSetup({}, "UNKNOWN")).toEqual([]);
  });
});

describe("ad set and ad setup", () => {
  const extra = { ADSET_AGE: "30-65+", ADSET_NAME: "CS_A01", MEDIA_SPEC: "1080x1080", OTHER: "x", FORM_QUESTIONS: "Q1 · Q2" };
  it("reads the ad set rows", () => expect(adSetSetup(extra).map((r) => r.value)).toEqual(["CS_A01", "30-65+"]));
  it("reads the ad rows", () => expect(adSetup(extra)).toEqual([{ key: "MEDIA_SPEC", label: "Mídia: tamanho e tipo", value: "1080x1080" }]));
});

describe("extra helpers", () => {
  it("keeps only string values", () => expect(asExtra({ a: "1", b: 2, c: null })).toEqual({ a: "1" }));
  it("handles non objects", () => {
    expect(asExtra(null)).toEqual({});
    expect(asExtra(["a"])).toEqual({});
  });
  it("leaves out what the setup panels show", () => expect(otherExtra({ TASKS: "a", META_OBJECTIVE: "b", X: "c" }, CAMPAIGN_SETUP_KEYS)).toEqual([["X", "c"]]));
});
