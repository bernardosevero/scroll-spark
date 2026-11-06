import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface Sealer {
  seal(plaintext: string): string;
  /** Null when the value is damaged, forged, or sealed for another purpose. */
  open(sealed: string): string | null;
}

/** AES-256-GCM, with a separate key per purpose so a cookie can't be replayed as a token. */
export function createSealer({
  secretKey,
  purpose,
}: {
  secretKey: string;
  purpose: string;
}): Sealer {
  const key = Buffer.from(
    hkdfSync("sha256", Buffer.from(secretKey, "base64"), Buffer.alloc(0), purpose, 32),
  );

  return {
    seal(plaintext) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
    },

    open(sealed) {
      try {
        const raw = Buffer.from(sealed, "base64url");
        const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
        decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));

        return Buffer.concat([
          decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        return null;
      }
    },
  };
}
