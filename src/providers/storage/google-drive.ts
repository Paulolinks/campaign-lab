import type { AssetStorageProvider } from "./types";

/**
 * Google Drive storage (planned). Will use OAuth with the `drive.file` scope and resumable uploads,
 * saving driveFileId in MediaAsset. Until a real token is validated it reports "not configured"
 * and every operation fails loudly instead of pretending the file was saved.
 */
export class GoogleDriveStorageProvider implements AssetStorageProvider {
  readonly id = "GOOGLE_DRIVE" as const;

  async isConfigured() {
    return false;
  }

  async put(): Promise<never> {
    throw new Error("Google Drive ainda não está conectado.");
  }

  async size(): Promise<never> {
    throw new Error("Google Drive ainda não está conectado.");
  }

  read(): never {
    throw new Error("Google Drive ainda não está conectado.");
  }

  async remove(): Promise<never> {
    throw new Error("Google Drive ainda não está conectado.");
  }
}
