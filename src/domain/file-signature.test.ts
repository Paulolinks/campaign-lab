import { describe, expect, it } from "vitest";
import { sniffFileType } from "./file-signature";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const text = (s: string) => new Uint8Array([...new TextEncoder().encode(s), ...new Array(16).fill(0)]);

describe("sniffFileType", () => {
  it("detects JPEG and PNG", () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mimeType).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mimeType).toBe("image/png");
  });

  it("detects MP4 and MOV by the ftyp box", () => {
    expect(sniffFileType(text("\0\0\0\x20ftypisom"))).toEqual({ kind: "VIDEO", mimeType: "video/mp4" });
    expect(sniffFileType(text("\0\0\0\x14ftypqt  "))).toEqual({ kind: "VIDEO", mimeType: "video/quicktime" });
  });

  it("detects PDF", () => {
    expect(sniffFileType(text("%PDF-1.7"))?.kind).toBe("DOCUMENT");
  });

  it("rejects HTML/scripts renamed as video", () => {
    expect(sniffFileType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffFileType(text("MZ\x90\0"))).toBeNull();
  });
});
