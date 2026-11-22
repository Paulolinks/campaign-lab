import "server-only";
import { env } from "@/lib/env";
import { GoogleDriveStorageProvider } from "./google-drive";
import { LocalStorageProvider } from "./local";
import type { AssetStorageProvider } from "./types";

export type { AssetStorageProvider } from "./types";

const providers = {
  LOCAL: () => new LocalStorageProvider(env("MEDIA_DIR")),
  GOOGLE_DRIVE: () => new GoogleDriveStorageProvider(),
};

export function storageFor(id: keyof typeof providers): AssetStorageProvider {
  return providers[id]();
}

/** Where new uploads go. Drive takes over once it is connected (sync job moves files off the VPS). */
export function uploadTarget(): AssetStorageProvider {
  return storageFor("LOCAL");
}

export function maxUploadBytes() {
  return Number(env("MAX_UPLOAD_MB")) * 1024 * 1024;
}
