import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./money-input";

describe("parseMoneyInput", () => {
  it("accepts dollars with up to 2 decimals, comma or dot", () => {
    expect(parseMoneyInput("20.00")).toBe("20.00");
    expect(parseMoneyInput("120")).toBe("120");
    expect(parseMoneyInput(" 40,5 ")).toBe("40.5");
  });

  it("blank means not set", () => {
    expect(parseMoneyInput("")).toBeNull();
  });

  it("rejects text, negatives and 3 decimals", () => {
    expect(parseMoneyInput("abc")).toBeUndefined();
    expect(parseMoneyInput("-5")).toBeUndefined();
    expect(parseMoneyInput("1.234")).toBeUndefined();
    expect(parseMoneyInput("ddd")).toBeUndefined();
  });
});
