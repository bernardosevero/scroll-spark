import { createHash, randomBytes } from "node:crypto";

import type { TokenCrypto } from "@scroll-spark/core/extension-token/extension-token.service";

/**
 * 256 random bits, so a plain SHA-256 is enough to store: there is nothing to guess or to
 * precompute. The prefix makes a leaked token easy to recognise in a log or a scanner.
 */
export const tokenCrypto: TokenCrypto = {
  randomToken: () => `ssx_${randomBytes(32).toString("base64url")}`,
  hash: (token) => createHash("sha256").update(token).digest("hex"),
};
