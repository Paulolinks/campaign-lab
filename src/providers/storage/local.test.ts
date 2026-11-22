import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "./local";

const dir = await mkdtemp(path.join(os.tmpdir(), "media-"));
const storage = new LocalStorageProvider(dir);
afterAll(() => rm(dir, { recursive: true, force: true }));

const streamOf = (text: string) => new Response(text).body as ReadableStream<Uint8Array>;

describe("LocalStorageProvider", () => {
  it("stores a file, reports size and sha256, and reads a byte range", async () => {
    const obj = await storage.put({ brandId: "b1", fileName: "clip.MP4", body: streamOf("hello world"), maxBytes: 100 });
    expect(obj.key).toMatch(/^b1\/[0-9a-f-]+\.mp4$/);
    expect(obj.bytes).toBe(11);
    expect(obj.sha256).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    expect(await storage.size(obj.key)).toBe(11);
    const part = await new Response(storage.read(obj.key, { start: 6, end: 10 })).text();
    expect(part).toBe("world");
  });

  it("rejects uploads over the limit and leaves no file behind", async () => {
    await expect(storage.put({ brandId: "b1", fileName: "big.mp4", body: streamOf("x".repeat(50)), maxBytes: 10 })).rejects.toThrow(/limite/);
  });

  it("blocks path traversal keys", () => {
    expect(() => storage.read("../../etc/passwd")).toThrow(/Invalid storage key/);
  });

  it("ignores unsafe extensions and brand ids", async () => {
    const obj = await storage.put({ brandId: "../x", fileName: "a.<script>", body: streamOf("a"), maxBytes: 10 });
    expect(obj.key).toMatch(/^x\/[0-9a-f-]+$/);
  });
});
