import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCscamp } from "./cscamp-parser";

const example = readFileSync("context/reference/02_EXEMPLO_CAMPANHA_IMPORTAVEL.txt", "utf8");

const minimal = (adBody = "") => `CSCAMP/1
CAMPAIGN
CAMPAIGN_KEY: K1
BRAND: Acme
PERSONA: P
SERVICE: S
OBJECTIVE: O
TEST_HYPOTHESIS: H
CHANNELS: META_PAID
LANDING_URL: https://example.com
AD
AD_KEY: K1-A
ANGLE: A
FORMAT: F
FUNNEL_STAGE: F
HOOK: H
PRIMARY_TEXT: T
HEADLINE: H
CTA: C
VISUAL_DIRECTION: V
${adBody}END_AD
END_CAMPAIGN
`;

describe("parseCscamp", () => {
  it("parses the example file with 3 ads and multiline fields", () => {
    const r = parseCscamp(example);
    expect(r.errors).toEqual([]);
    expect(r.campaigns).toHaveLength(1);
    const [c] = r.campaigns;
    expect(c.fields.CAMPAIGN_KEY).toBe("CS-MS-QUALITY-2026-11");
    expect(c.ads.map((a) => a.fields.AD_KEY)).toEqual([
      "CS-MS-QUALITY-2026-11-A01",
      "CS-MS-QUALITY-2026-11-B01",
      "CS-MS-QUALITY-2026-11-C01",
    ]);
    expect(c.ads[0].fields.ANGLE).toBe("INSTALLATION_QUALITY");
    expect(c.ads[0].fields.VIDEO_SCRIPT).toContain("SCENE 04 | CTA");
    expect(c.ads[0].fields.PRIMARY_TEXT.split("\n")[0]).toMatch(/^Thinking about installing/);
  });

  it("accepts CRLF line endings and a BOM", () => {
    const r = parseCscamp("﻿" + minimal().replace(/\n/g, "\r\n"));
    expect(r.errors).toEqual([]);
    expect(r.campaigns[0].ads).toHaveLength(1);
  });

  it("rejects a file that does not start with CSCAMP/1", () => {
    const r = parseCscamp("HELLO\nCAMPAIGN\n");
    expect(r.errors[0].message).toMatch(/CSCAMP\/1/);
  });

  it("reports a missing required ad field with the line of the AD", () => {
    const text = minimal().replace("HEADLINE: H\n", "");
    const r = parseCscamp(text);
    expect(r.errors).toContainEqual({ line: 11, message: "Anúncio sem campo obrigatório HEADLINE." });
  });

  it("reports an unclosed multiline field", () => {
    const r = parseCscamp(minimal("NOTES: <<<\nnever closed\n"));
    expect(r.errors.some((e) => e.message.includes("faltou a linha >>>"))).toBe(true);
  });

  it("reports duplicate AD_KEY inside the same file", () => {
    const twoAds = minimal().replace("END_CAMPAIGN", minimal().split("CAMPAIGN\n")[1].split("LANDING_URL: https://example.com\n")[1].replace("END_CAMPAIGN\n", "") + "END_CAMPAIGN");
    const r = parseCscamp(twoAds);
    expect(r.errors.some((e) => e.message.includes("AD_KEY repetido"))).toBe(true);
  });

  it("supports more than one campaign per file", () => {
    const second = minimal().replace("CSCAMP/1\n", "").replaceAll("K1", "K2");
    const r = parseCscamp(minimal() + second);
    expect(r.errors).toEqual([]);
    expect(r.campaigns.map((c) => c.fields.CAMPAIGN_KEY)).toEqual(["K1", "K2"]);
  });

  it("keeps HTML as plain text (no interpretation)", () => {
    const r = parseCscamp(minimal().replace("HOOK: H", "HOOK: <script>alert(1)</script>"));
    expect(r.campaigns[0].ads[0].fields.HOOK).toBe("<script>alert(1)</script>");
  });

  it("rejects files over 2 MB", () => {
    const r = parseCscamp("x".repeat(2_000_001));
    expect(r.errors[0].message).toMatch(/muito grande/);
  });
});
