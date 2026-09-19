import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

// SECURITY: Account access/refresh tokens are currently stored plaintext
// (better-auth writes them directly via the Prisma adapter). This helper is
// envelope-ready application-level AES-256-GCM for TOKEN_ENCRYPTION_KEY, to be
// wired in before public launch. NOT wired into gmail.ts yet on purpose: the
// token write path lives inside better-auth (automatic), so decrypt-on-read
// without encrypt-on-write would break refresh. Wiring needs a
// better-auth database hook / custom adapter that encrypts on write.
function getKey(): Buffer {
  const raw =
    process.env["TOKEN_ENCRYPTION_KEY"] ?? process.env["BETTER_AUTH_SECRET"];
  if (!raw) {
    throw new Error(
      "Missing TOKEN_ENCRYPTION_KEY (fallback BETTER_AUTH_SECRET). Generate with: openssl rand -base64 32",
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function isTokenCryptoConfigured(): boolean {
  return Boolean(
    process.env["TOKEN_ENCRYPTION_KEY"] ?? process.env["BETTER_AUTH_SECRET"],
  );
}

/** AES-256-GCM encrypt. Returns `ivB64.tagB64.dataB64`. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/** Inverse of encryptToken. Throws on tamper / wrong key. */
export function decryptToken(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return (
    decipher.update(Buffer.from(dataB64, "base64")).toString("utf8") +
    decipher.final("utf8")
  );
}
