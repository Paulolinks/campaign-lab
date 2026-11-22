import { describe, expect, it } from "vitest";
import { leadFieldsFromForm, readableAnswers, unixSeconds } from "./meta-leads";

describe("leadFieldsFromForm", () => {
  it("reads the standard Meta form fields", () => {
    const f = leadFieldsFromForm([
      { name: "full_name", values: ["Mary Smith"] },
      { name: "phone_number", values: ["+14045550123"] },
      { name: "email", values: ["Mary@Example.com"] },
      { name: "zip_code", values: ["30060"] },
    ]);
    expect(f).toEqual({ name: "Mary Smith", phone: "+14045550123", email: "mary@example.com", zip: "30060" });
  });
  it("joins first and last name when there is no full name", () => {
    expect(leadFieldsFromForm([{ name: "first_name", values: ["John"] }, { name: "last_name", values: ["Doe"] }]).name).toBe("John Doe");
  });
  it("never leaves the name empty", () => {
    expect(leadFieldsFromForm([{ name: "phone_number", values: ["+14045550123"] }]).name).toBe("+14045550123");
    expect(leadFieldsFromForm(undefined).name).toBe("Lead da Meta (sem nome)");
  });
});

describe("readableAnswers", () => {
  it("turns Meta keys into readable questions", () => {
    expect(readableAnswers([{ name: "what_service_do_you_need?", values: ["Heat pump"] }])).toEqual([{ question: "What service do you need", answer: "Heat pump" }]);
  });
  it("skips empty answers", () => expect(readableAnswers([{ name: "x", values: [] }])).toEqual([]));
});

describe("unixSeconds", () => {
  it("converts a date to Unix seconds", () => expect(unixSeconds(new Date("2026-11-22T00:00:00Z"))).toBe(1795305600));
});
