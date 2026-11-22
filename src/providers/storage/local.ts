import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { UploadTooLargeError, type AssetStorageProvider, type ByteRange, type StoredObject } from "./types";

/** Files on the server disk, under MEDIA_DIR/<brandId>/<uuid><ext>. Keys are generated, never user input. */
export class LocalStorageProvider implements AssetStorageProvider {
  readonly id = "LOCAL" as const;

  constructor(private readonly root: string) {}

  async isConfigured() {
    return true;
  }

  async put({ brandId, fileName, body, maxBytes }: { brandId: string; fileName: string; body: ReadableStream<Uint8Array>; maxBytes: number }): Promise<StoredObject> {
    const ext = safeExtension(fileName);
    const key = `${safeSegment(brandId)}/${randomUUID()}${ext}`;
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });

    const hash = createHash("sha256");
    let bytes = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length;
        if (bytes > maxBytes) return done(new UploadTooLargeError(maxBytes));
        hash.update(chunk);
        done(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), meter, createWriteStream(target));
    } catch (err) {
      await rm(target, { force: true });
      throw err;
    }
    return { key, bytes, sha256: hash.digest("hex") };
  }

  async size(key: string) {
    return (await stat(this.resolve(key))).size;
  }

  read(key: string, range?: ByteRange): ReadableStream<Uint8Array> {
    const stream = createReadStream(this.resolve(key), range ? { start: range.start, end: range.end } : undefined);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  /** Blocks path traversal: the resolved path must stay inside the root. */
  private resolve(key: string) {
    const root = path.resolve(this.root);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function safeExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}
