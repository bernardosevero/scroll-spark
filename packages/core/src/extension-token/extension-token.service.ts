import { AppError } from "../errors/app-error";
import type { Clock } from "../time/clock";
import type { ConnectedToken, ExtensionToken, RevokeTokenInput } from "./schemas";

/** How long a connection lasts before the user connects the side panel again. */
export const EXTENSION_TOKEN_DAYS = 30;

export interface ExtensionTokenRecord {
  id: string;
  userId: string;
  /** The token itself is never stored, only this. */
  tokenHash: string;
  expiresAt: Date;
  /** Null while the token works. Once set, it never works again. */
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ExtensionTokenRepository {
  insert(row: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<ExtensionTokenRecord>;
  findByHash(tokenHash: string): Promise<ExtensionTokenRecord | null>;
  /** Only this user's tokens, newest first. */
  listForUser(userId: string): Promise<ExtensionTokenRecord[]>;
  /** False when the token doesn't exist or belongs to someone else. Revoking twice is fine. */
  revoke(userId: string, tokenId: string, at: Date): Promise<boolean>;
}

/** Randomness and hashing come from the host, since `core` can't reach `node:crypto`. */
export interface TokenCrypto {
  randomToken(): string;
  hash(token: string): string;
}

export interface ExtensionTokenService {
  connect(userId: string): Promise<ConnectedToken>;
  /** The user behind a token, or null when it is unknown, expired or revoked. */
  resolve(token: string): Promise<string | null>;
  /** Connections that still work. */
  list(userId: string): Promise<ExtensionToken[]>;
  revoke(userId: string, input: RevokeTokenInput): Promise<void>;
}

export function createExtensionTokenService({
  tokens,
  crypto,
  clock,
}: {
  tokens: ExtensionTokenRepository;
  crypto: TokenCrypto;
  clock: Clock;
}): ExtensionTokenService {
  const isActive = ({ revokedAt, expiresAt }: ExtensionTokenRecord) =>
    revokedAt === null && expiresAt > clock.now();

  return {
    async connect(userId) {
      const token = crypto.randomToken();
      const createdAt = clock.now();
      const expiresAt = new Date(createdAt.getTime() + EXTENSION_TOKEN_DAYS * 24 * 60 * 60 * 1000);

      const record = await tokens.insert({
        userId,
        tokenHash: crypto.hash(token),
        expiresAt,
        createdAt,
      });

      return {
        id: record.id,
        token,
        createdAt: record.createdAt.toISOString(),
        expiresAt: record.expiresAt.toISOString(),
      };
    },

    async resolve(token) {
      if (token === "") {
        return null;
      }

      const record = await tokens.findByHash(crypto.hash(token));

      return record !== null && isActive(record) ? record.userId : null;
    },

    async list(userId) {
      const records = await tokens.listForUser(userId);

      return records.filter(isActive).map(({ id, createdAt, expiresAt }) => ({
        id,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }));
    },

    async revoke(userId, { tokenId }) {
      if (!(await tokens.revoke(userId, tokenId, clock.now()))) {
        throw new AppError("NOT_FOUND");
      }
    },
  };
}
