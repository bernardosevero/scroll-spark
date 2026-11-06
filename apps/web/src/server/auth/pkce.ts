import { createHash, randomBytes } from "node:crypto";

import type { PkceCrypto } from "@scroll-spark/core/auth/auth.service";

export const pkceCrypto: PkceCrypto = {
  randomToken: () => randomBytes(32).toString("base64url"),
  challengeFor: (verifier) =>
    Promise.resolve(createHash("sha256").update(verifier).digest("base64url")),
};
