# Code conventions

`packages/core/src/ping/` is the example to copy. Lint enforces imports, `process.env`, `console`, barrels and default exports in packages, so this file covers what a linter can't see.

## Services

A service is a factory that receives what it needs.

```ts
export function createCaptureService(deps: {
  buffer: BufferGateway;
  llm: LlmGateway;
  captures: CaptureRepository;
  clock: Clock;
}) {
  return { analyze, saveAsIdea };
}
```

- Put interfaces beside the service that needs them, named for the role (`BufferGateway`).
- Wire real adapters only in `apps/web/src/server/composition.ts`.
- Time, randomness and I/O come in as dependencies, so flows run the same in tests.

## Feature layout

```text
packages/core/src/<feature>/
  <feature>.service.ts
  schemas.ts
  <feature>.flow.test.ts
```

Boundary shapes are Zod schemas in `schemas.ts`, with types inferred from them. Anything crossing the API, or arriving from Buffer or Claude, is parsed.

## API

Routers are one-line forwards. If a router needs an `if`, that logic belongs in the service.

```ts
ping: procedure
  .input(pingInputSchema)
  .output(pingOutputSchema)
  .mutation(({ ctx, input }) => ctx.services.ping.ping(input)),
```

The website and side panel both call the API through `@scroll-spark/api`. OAuth callbacks and the health check are plain route handlers.

## Errors

Expected failures throw `AppError` with a code from the fixed list in `core/src/errors/app-error.ts`. Adding a failure means adding a code, its tRPC mapping, and its user message.

- Buffer can return HTTP 200 with an error inside. The Buffer adapter converts those into `AppError`.
- Honour `Retry-After` on 429s, and never loop.
- Anything unexpected is logged and shows a generic message.
- Catch an error only when you can do something useful with it.

## Logging

Use the injected `Logger`, one event per call: `logger.info("capture.analyzed", { captureId, ms })`. Fields are IDs, codes and timings. Tokens and post text stay out of logs.

## React

- Components render props. Keep them short, and extract named pieces.
- A hook wraps one source: one query, one mutation, or one store selector. Multi-source coordination belongs in a service.
- TanStack Query holds server data. Add Zustand only when view state truly needs sharing, and keep stores to state and setters.
- Every screen handles loading, empty and error states.
- Use real `<button>`, `<a>` and `<label>` elements, with visible focus.

## Naming and imports

- Files are kebab-case. Exports are named, except where Next.js or WXT requires a default.
- Booleans read as questions: `isFeatured`, `hasHistory`.
- Inside a feature, import relatively. Across features and packages, use package names. Inside `apps/web`, `@/` points to `src`.
- Add a package's public files to its `package.json` `exports`.

## Dependencies

Prefer a few lines of local code for simple needs. Releases younger than 7 days are refused by `minimumReleaseAge`.
