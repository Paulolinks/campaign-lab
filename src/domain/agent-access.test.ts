import { describe, expect, it } from "vitest";
import { answersWithoutPii, creativeText, generateAgentKey, hashAgentKey, readAgentKey } from "./agent-access";

describe("agent key", () => {
  it("generates a long random key with the prefix", () => {
    const a = generateAgentKey();
    expect(a).toMatch(/^clab_[A-Za-z0-9_-]{43}$/);
    expect(generateAgentKey()).not.toBe(a);
  });
  it("hashes the same key to the same value", () => expect(hashAgentKey("clab_x")).toBe(hashAgentKey("clab_x")));

  const key = generateAgentKey();
  const headers = (h: Record<string, string>) => (n: string) => h[n] ?? null;
  it("reads x-agent-key or a Bearer token", () => {
    expect(readAgentKey(headers({ "x-agent-key": key }))).toBe(key);
    expect(readAgentKey(headers({ authorization: `Bearer ${key}` }))).toBe(key);
  });
  it("ignores missing, short or foreign keys", () => {
    expect(readAgentKey(headers({}))).toBeNull();
    expect(readAgentKey(headers({ "x-agent-key": "clab_short" }))).toBeNull();
    expect(readAgentKey(headers({ authorization: "Bearer EAAB" + "x".repeat(60) }))).toBeNull();
  });
});

describe("answersWithoutPii", () => {
  it("drops name, phone, e-mail and address, keeps the rest", () => {
    const answers = [
      { name: "full_name", values: ["Jane Doe"] },
      { name: "phone_number", values: ["+1 404"] },
      { name: "email", values: ["j@x.com"] },
      { name: "street_address", values: ["1 Main"] },
      { name: "zip_code", values: ["30060"] },
      { name: "what_do_you_need?", values: ["New AC"] },
    ];
    expect(answersWithoutPii(answers)).toEqual([
      { name: "zip_code", values: ["30060"] },
      { name: "what_do_you_need?", values: ["New AC"] },
    ]);
  });
  it("returns an empty list for anything else", () => {
    expect(answersWithoutPii(null)).toEqual([]);
    expect(answersWithoutPii("x")).toEqual([]);
  });
});

describe("creativeText", () => {
  it("reads text from a link ad", () => {
    const c = creativeText({
      thumbnail_url: "t.jpg",
      object_story_spec: { link_data: { message: "Body", name: "Headline", description: "Desc", link: "https://x.com", call_to_action: { type: "LEARN_MORE" } } },
    });
    expect(c).toMatchObject({ title: "Headline", body: "Body", description: "Desc", cta: "LEARN_MORE", link: "https://x.com", imageUrl: "t.jpg" });
  });
  it("reads text from a video ad", () => {
    expect(creativeText({ object_story_spec: { video_data: { message: "Watch", title: "T", video_id: "99", call_to_action: { type: "SIGN_UP" } } } })).toMatchObject({
      body: "Watch", title: "T", videoId: "99", cta: "SIGN_UP",
    });
  });
  it("keeps every version of a dynamic creative", () => {
    const c = creativeText({ asset_feed_spec: { bodies: [{ text: "A" }, { text: "B" }, { text: "A" }], titles: [{ text: "T1" }] } });
    expect(c).toMatchObject({ body: "A", bodies: ["A", "B"], title: "T1", titles: ["T1"] });
  });
  it("prefers the top-level fields", () => expect(creativeText({ body: "Top", object_story_spec: { link_data: { message: "Nested" } } })?.body).toBe("Top"));
  it("returns null when there is nothing", () => {
    expect(creativeText(undefined)).toBeNull();
    expect(creativeText({ call_to_action_type: "CALL_NOW" })).toBeNull();
  });
});
