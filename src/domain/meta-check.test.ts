import { describe, expect, it } from "vitest";
import { accountStatus, checkPermissions, normalizeAdAccountId, normalizePageId } from "./meta-check";

describe("meta-check", () => {
  it("accepts only numeric page ids", () => {
    expect(normalizePageId(" 1234567890 ")).toBe("1234567890");
    expect(normalizePageId("coolseason")).toBeNull();
  });

  it("normalizes the ad account id", () => {
    expect(normalizeAdAccountId("123456789")).toBe("act_123456789");
    expect(normalizeAdAccountId(" act_123456789 ")).toBe("act_123456789");
    expect(normalizeAdAccountId("abc")).toBeNull();
    expect(normalizeAdAccountId(null)).toBeNull();
  });

  it("splits granted and missing permissions (declined counts as missing)", () => {
    const r = checkPermissions([
      { permission: "ads_read", status: "granted" },
      { permission: "ads_management", status: "declined" },
    ]);
    expect(r.granted).toEqual(["ads_read"]);
    expect(r.missing).toContain("ads_management");
    expect(r.missing).not.toContain("ads_read");
  });

  it("explains the ad account status", () => {
    expect(accountStatus(1)).toEqual({ label: "Ativa", ok: true });
    expect(accountStatus(3).ok).toBe(false);
    expect(accountStatus(undefined).ok).toBe(false);
  });
});
