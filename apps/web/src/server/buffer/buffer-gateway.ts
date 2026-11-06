import { z } from "zod";

import type { BufferGateway, GatewayResult } from "@scroll-spark/core/buffer/buffer.service";
import {
  bufferAccountSchema,
  bufferChannelsSchema,
  bufferIdeaSchema,
  bufferPostSchema,
} from "@scroll-spark/core/buffer/schemas";
import { AppError } from "@scroll-spark/core/errors/app-error";
import type { AppErrorCode } from "@scroll-spark/core/errors/app-error";
import type { Logger } from "@scroll-spark/core/logging/logger";
import type { Clock } from "@scroll-spark/core/time/clock";

import { parseRateLimit } from "./rate-limit-headers";

// The only place the app talks to api.buffer.com. Same timeout as the OAuth adapter.
const GRAPHQL_URL = "https://api.buffer.com";
const TIMEOUT_MS = 8_000;
const PAGE_SIZE = 50;

const FIELDS = {
  channel: "id service name displayName descriptor avatar timezone isLocked isDisconnected",
  post: "id channelId text status dueAt sentAt ideaId",
  idea: "id content { title text }",
} as const;

const QUERIES = {
  account: `query Account { account { id organizations { id name channelCount limits { ideas scheduledPosts tags } } } }`,
  channels: `query Channels($input: ChannelsInput!) { channels(input: $input) { ${FIELDS.channel} } }`,
  posts: `query Posts($first: Int, $after: String, $input: PostsInput!) { posts(first: $first, after: $after, input: $input) { edges { cursor node { ${FIELDS.post} } } pageInfo { endCursor hasNextPage } } }`,
  ideas: `query Ideas($first: Int, $after: String, $input: IdeasInput!) { ideas(first: $first, after: $after, input: $input) { edges { cursor node { ${FIELDS.idea} } } pageInfo { endCursor hasNextPage } } }`,
  createIdea: `mutation CreateIdea($input: CreateIdeaInput!) { createIdea(input: $input) { __typename ... on Idea { ${FIELDS.idea} } } }`,
  createPost: `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { ${FIELDS.post} } } } }`,
} as const;

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z
    .array(
      z.object({
        extensions: z.object({ code: z.string().optional() }).passthrough().optional(),
      }),
    )
    .optional(),
});

const connectionSchema = <T extends z.ZodType>(node: T) =>
  z.object({
    edges: z.array(z.object({ node })),
    pageInfo: z.object({ endCursor: z.string().nullable(), hasNextPage: z.boolean() }),
  });

const ideaNodeSchema = z.object({
  id: z.string(),
  content: z.object({ title: z.string().nullable(), text: z.string().nullable() }).nullable(),
});

const mutationSchema = z.object({ __typename: z.string() }).passthrough();

/** Buffer's typed errors, which arrive inside HTTP 200. */
const CODE_BY_TYPENAME: Record<string, AppErrorCode> = {
  LimitReachedError: "BUFFER_LIMIT_REACHED",
  InvalidInputError: "INVALID_INPUT",
  DuplicateError: "INVALID_INPUT",
  NotFoundError: "NOT_FOUND",
  UnauthorizedError: "RECONNECT_REQUIRED",
  UnexpectedError: "BUFFER_FAILED",
};

const CODE_BY_GRAPHQL_CODE: Record<string, AppErrorCode> = {
  RATE_LIMIT_EXCEEDED: "BUFFER_RATE_LIMITED",
  UNAUTHENTICATED: "RECONNECT_REQUIRED",
  UNAUTHORIZED: "RECONNECT_REQUIRED",
};

function retryAfterOf(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds >= 0 && response.headers.has("retry-after")
    ? { retryAfterSeconds: Math.ceil(seconds) }
    : {};
}

export function createBufferGateway({
  clock,
  logger,
  fetch: send = fetch,
}: {
  clock: Clock;
  logger: Logger;
  fetch?: typeof fetch;
}): BufferGateway {
  /**
   * One request, never repeated. Logs hold the operation, a status or a code, and nothing the
   * user wrote. Error bodies and messages can echo a request, so none of them is logged.
   */
  async function execute(
    accessToken: string,
    operation: keyof typeof QUERIES,
    variables: Record<string, unknown>,
  ): Promise<{ data: unknown; quota: GatewayResult<unknown>["quota"] }> {
    let response: Response;

    try {
      response = await send(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ query: QUERIES[operation], variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (cause) {
      logger.warn("buffer.request_failed", {
        operation,
        reason: cause instanceof Error ? cause.name : "unknown",
      });
      throw new AppError("BUFFER_FAILED", { cause });
    }

    if (response.status === 429) {
      logger.warn("buffer.rate_limited", { operation });
      throw new AppError("BUFFER_RATE_LIMITED", retryAfterOf(response));
    }

    if (response.status === 401 || response.status === 403) {
      logger.warn("buffer.unauthorized", { operation, status: response.status });
      throw new AppError("RECONNECT_REQUIRED");
    }

    if (!response.ok) {
      logger.error("buffer.bad_status", { operation, status: response.status });
      throw new AppError("BUFFER_FAILED");
    }

    const quota = parseRateLimit(response.headers, clock.now());
    const envelope = envelopeSchema.safeParse(await response.json().catch(() => null));

    if (!envelope.success) {
      logger.error("buffer.bad_body", { operation });
      throw new AppError("BUFFER_FAILED");
    }

    const [first] = envelope.data.errors ?? [];

    if (first !== undefined) {
      const graphqlCode = first.extensions?.code ?? "";
      logger.warn("buffer.graphql_error", { operation, code: graphqlCode });
      throw new AppError(CODE_BY_GRAPHQL_CODE[graphqlCode] ?? "BUFFER_FAILED");
    }

    return { data: envelope.data.data, quota };
  }

  function parse<S extends z.ZodType>(operation: string, schema: S, value: unknown): z.infer<S> {
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      logger.error("buffer.unexpected_shape", { operation });
      throw new AppError("BUFFER_FAILED");
    }

    return parsed.data;
  }

  async function read<S extends z.ZodType, T>(
    operation: "account" | "channels" | "posts" | "ideas",
    variables: Record<string, unknown>,
    accessToken: string,
    schema: S,
    pick: (data: z.infer<S>) => T,
  ): Promise<GatewayResult<T>> {
    const { data, quota } = await execute(accessToken, operation, variables);

    return { data: pick(parse(operation, schema, data)), quota };
  }

  /** Returns the payload when it is the success type, or throws for a typed error. */
  async function mutate(
    accessToken: string,
    operation: "createIdea" | "createPost",
    successType: string,
    input: Record<string, unknown>,
  ) {
    const { data, quota } = await execute(accessToken, operation, { input });
    const payload = parse(operation, z.object({ [operation]: mutationSchema }), data)[
      operation
    ] as z.infer<typeof mutationSchema>;

    if (payload.__typename !== successType) {
      const code = CODE_BY_TYPENAME[payload.__typename] ?? "BUFFER_FAILED";
      logger.warn("buffer.typed_error", { operation, type: payload.__typename, code });
      throw new AppError(code);
    }

    return { payload, quota };
  }

  const pageVariables = (
    organizationId: string,
    extra: Record<string, unknown> = {},
    page: { first?: number; after?: string } = {},
  ) => ({
    first: page.first ?? PAGE_SIZE,
    ...(page.after === undefined ? {} : { after: page.after }),
    input: { organizationId, ...extra },
  });

  return {
    account: (accessToken) =>
      read(
        "account",
        {},
        accessToken,
        z.object({ account: bufferAccountSchema }),
        (d) => d.account,
      ),

    channels: (accessToken, organizationId) =>
      read(
        "channels",
        { input: { organizationId } },
        accessToken,
        z.object({ channels: bufferChannelsSchema }),
        (d) => d.channels,
      ),

    posts: (accessToken, { organizationId, channelIds, after, first }) =>
      read(
        "posts",
        pageVariables(
          organizationId,
          {
            // `sort` is required by Buffer. The values are unconfirmed until #2.
            sort: [{ field: "dueAt", direction: "desc" }],
            ...(channelIds === undefined || channelIds.length === 0
              ? {}
              : { filter: { channelIds } }),
          },
          { first, after },
        ),
        accessToken,
        z.object({ posts: connectionSchema(bufferPostSchema) }),
        ({ posts }) => ({
          posts: posts.edges.map((edge) => edge.node),
          endCursor: posts.pageInfo.endCursor,
          hasNextPage: posts.pageInfo.hasNextPage,
        }),
      ),

    ideas: (accessToken, organizationId) =>
      read(
        "ideas",
        pageVariables(organizationId),
        accessToken,
        z.object({ ideas: connectionSchema(ideaNodeSchema) }),
        ({ ideas }) =>
          ideas.edges.map(({ node }) =>
            bufferIdeaSchema.parse({
              id: node.id,
              title: node.content?.title ?? null,
              text: node.content?.text ?? null,
            }),
          ),
      ),

    async createIdea(accessToken, { organizationId, title, text }) {
      const { payload, quota } = await mutate(accessToken, "createIdea", "Idea", {
        organizationId,
        // The schema marks `tags` required, though Buffer's example omits it. Never creates tags.
        content: { ...(title === undefined ? {} : { title }), text, tags: [] },
      });
      const node = parse("createIdea", ideaNodeSchema, payload);

      return {
        data: { id: node.id, title: node.content?.title ?? null, text: node.content?.text ?? null },
        quota,
      };
    },

    async createPost(accessToken, input) {
      const { payload, quota } = await mutate(accessToken, "createPost", "PostActionSuccess", {
        channelId: input.channelId,
        text: input.text,
        ...(input.ideaId === undefined ? {} : { ideaId: input.ideaId }),
        ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt }),
        mode: input.mode,
        schedulingType: "automatic",
        needsApproval: false,
        // Text only, so no media. The exact shape for "none" is unconfirmed until #2.
        assets: {},
        saveToDraft: input.saveToDraft,
      });

      return {
        data: parse("createPost", z.object({ post: bufferPostSchema }), payload).post,
        quota,
      };
    },
  };
}
