/**
 * Symmetric encryption for secrets stored in the database (AES-256-GCM, random 12-byte IV, auth tag).
 * Format: "v1:" + base64(iv | tag | ciphertext). The key is 32 bytes, derived from a server secret.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function deriveKey(serverSecret: string, purpose: string): Buffer {
  if (serverSecret.length < 16) throw new Error("Server secret too short to derive an encryption key.");
  return createHash("sha256").update(`${purpose}:${serverSecret}`).digest();
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "v1:" + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptSecret(box: string, key: Buffer): string {
  if (!box.startsWith("v1:")) throw new Error("Formato de segredo desconhecido.");
  const raw = Buffer.from(box.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** "EAAB...xyz9" → "••••xyz9". Never shows more than the last 4 characters. */
export function maskSecret(last4: string): string {
  return `••••${last4.slice(-4)}`;
}
