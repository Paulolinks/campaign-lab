import { describe, expect, it } from "vitest";
import { decryptSecret, deriveKey, encryptSecret, maskSecret } from "./secret-box";

const key = deriveKey("a-long-server-secret-for-tests", "meta");

describe("secret-box", () => {
  it("round-trips and never stores the plain text", () => {
    const box = encryptSecret("EAABtokenvalue1234", key);
    expect(box.startsWith("v1:")).toBe(true);
    expect(box).not.toContain("EAABtokenvalue1234");
    expect(decryptSecret(box, key)).toBe("EAABtokenvalue1234");
  });

  it("uses a new IV every time", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("fails with another key or a tampered box", () => {
    const box = encryptSecret("secret", key);
    expect(() => decryptSecret(box, deriveKey("another-long-server-secret", "meta"))).toThrow();
    const tampered = "v1:" + Buffer.from(Buffer.from(box.slice(3), "base64").map((b, i) => (i === 30 ? b ^ 1 : b))).toString("base64");
    expect(() => decryptSecret(tampered, key)).toThrow();
  });

  it("rejects a short server secret and masks to the last 4", () => {
    expect(() => deriveKey("short", "meta")).toThrow();
    expect(maskSecret("1a2b")).toBe("••••1a2b");
  });
});
