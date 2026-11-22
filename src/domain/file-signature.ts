/**
 * Detects the real file type from its first bytes (magic numbers), ignoring the name the user gave it.
 * Only these types are accepted for upload.
 */
export type SniffResult = { kind: "IMAGE" | "VIDEO" | "DOCUMENT"; mimeType: string } | null;

export function sniffFileType(head: Uint8Array): SniffResult {
  const at = (offset: number, ...bytes: number[]) => bytes.every((b, i) => head[offset + i] === b);
  const ascii = (offset: number, text: string) => at(offset, ...[...text].map((c) => c.charCodeAt(0)));

  if (at(0, 0xff, 0xd8, 0xff)) return { kind: "IMAGE", mimeType: "image/jpeg" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { kind: "IMAGE", mimeType: "image/png" };
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return { kind: "IMAGE", mimeType: "image/gif" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { kind: "IMAGE", mimeType: "image/webp" };
  if (ascii(4, "ftyp")) {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (brand === "qt  ") return { kind: "VIDEO", mimeType: "video/quicktime" };
    if (brand.startsWith("heic") || brand.startsWith("mif1")) return null;
    return { kind: "VIDEO", mimeType: "video/mp4" };
  }
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return { kind: "VIDEO", mimeType: "video/webm" };
  if (ascii(0, "%PDF-")) return { kind: "DOCUMENT", mimeType: "application/pdf" };
  return null;
}
