/** The cheapest way to prove the key works and the account has credit. */
const PING_REQUEST = {
  model: "claude-haiku-5-5",
  max_tokens: 16,
  messages: [{ role: "user" as const, content: "Reply with OK." }],
};

export type PingRequest = typeof PING_REQUEST;

export function createAnthropicPing({
  create,
}: {
  create: (request: PingRequest) => Promise<unknown>;
}) {
  return () => create(PING_REQUEST);
}
