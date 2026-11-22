/**
 * Where media files live. LOCAL is for development and as a temporary buffer on the VPS;
 * GOOGLE_DRIVE is the long-term home (files leave the VPS once synced). The database stays the
 * source of truth: storageKey / driveFileId point to the bytes, never the other way around.
 */
export type StoredObject = { key: string; bytes: number; sha256: string };

export type ByteRange = { start: number; end: number };

export interface AssetStorageProvider {
  readonly id: "LOCAL" | "GOOGLE_DRIVE";
  /** True only when credentials were validated. Never pretend to be connected. */
  isConfigured(): Promise<boolean>;
  put(input: { brandId: string; fileName: string; body: ReadableStream<Uint8Array>; maxBytes: number }): Promise<StoredObject>;
  size(key: string): Promise<number>;
  read(key: string, range?: ByteRange): ReadableStream<Uint8Array>;
  remove(key: string): Promise<void>;
}

export class UploadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Arquivo maior que o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
}
