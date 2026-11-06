import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@scroll-spark/api/client";
import { TRPCProvider } from "@scroll-spark/api/react";

import type { PendingCapture } from "../capture/pending-capture";
import type { StoredToken } from "../lib/connect-message";
import type { PanelEnvironment } from "./environment";
import { SidePanel } from "./side-panel";

const WEB = "https://spark.test";
const FUTURE = "2999-01-01T00:00:00.000Z";
const TOKEN: StoredToken = { value: "ssx_test", expiresAt: FUTURE };

const FOUND: PendingCapture = {
  id: "one",
  status: "found",
  capture: {
    text: "Consistancy beats talent.",
    author: "Sam Sample",
    url: "https://www.linkedin.com/feed/update/urn:li:activity:1/",
    platform: "linkedin",
  },
};

function createEnvironment(token: StoredToken | null, pending: PendingCapture | null) {
  const state = { token, pending };
  const listeners = new Set<() => void>();

  const environment: PanelEnvironment = {
    readToken: () => Promise.resolve(state.token),
    readPending: () => Promise.resolve(state.pending),
    clearPending() {
      state.pending = null;
      listeners.forEach((listener) => {
        listener();
      });
      return Promise.resolve();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    environment,
    capture(next: PendingCapture) {
      state.pending = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

/** Answers like the API: `capture.create` saves, unless told the sign-in has ended. */
function stubApi(behaviour: "saves" | "signed-out" = "saves") {
  const requests: { authorization: string | null; input: unknown }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      const body = JSON.parse(typeof init.body === "string" ? init.body : "{}") as Record<
        string,
        unknown
      >;
      requests.push({ authorization: headers.get("authorization"), input: body["0"] });

      const result =
        behaviour === "saves"
          ? {
              result: {
                data: {
                  id: "capture-1",
                  text: "saved",
                  sourceUrl: null,
                  platform: "pasted",
                  sourceName: null,
                  createdAt: "2026-11-06T12:00:00.000Z",
                },
              },
            }
          : {
              error: {
                message: "NOT_SIGNED_IN",
                code: -32001,
                data: { code: "UNAUTHORIZED", httpStatus: 401, appCode: "NOT_SIGNED_IN" },
              },
            };

      return Promise.resolve(
        Response.json([result], { status: behaviour === "saves" ? 200 : 401 }),
      );
    }),
  );

  return requests;
}

function renderPanel(environment: PanelEnvironment) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const trpcClient = createApiClient({
    url: `${WEB}/api/trpc`,
    getToken: () => environment.readToken().then((token) => token?.value ?? null),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <SidePanel environment={environment} webOrigin={WEB} />
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

const field = () => screen.findByLabelText(/Captured text/);

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(cleanup);

describe("signing in", () => {
  it.each([
    ["no token", null],
    ["an expired token", { value: "old", expiresAt: "2020-01-01T00:00:00.000Z" }],
  ])("asks for sign-in with %s, through the website's connect page", async (_case, token) => {
    renderPanel(createEnvironment(token, FOUND).environment);

    const link = await screen.findByRole("link", { name: "Sign in on the website" });

    expect(link).toHaveAttribute("href", `${WEB}/extension/connect`);
    expect(screen.queryByLabelText(/Captured text/)).toBeNull();
  });
});

describe("waiting for a capture", () => {
  it("says how to capture", async () => {
    renderPanel(createEnvironment(TOKEN, null).environment);

    expect(await screen.findByText("Spot something good?")).toBeInTheDocument();
    expect(screen.getByText(/right-click/)).toBeInTheDocument();
  });
});

describe("a captured post", () => {
  it("is shown for correction, then saved as corrected with the bearer token", async () => {
    const requests = stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    expect(await field()).toHaveValue("Consistancy beats talent.");
    expect(screen.getByText("From Sam Sample")).toBeInTheDocument();

    fireEvent.change(await field(), { target: { value: "Consistency beats talent." } });
    fireEvent.click(screen.getByRole("button", { name: "Save to inbox" }));

    expect(await screen.findByText("Saved to your inbox")).toBeInTheDocument();
    expect(requests).toEqual([
      {
        authorization: "Bearer ssx_test",
        input: {
          text: "Consistency beats talent.",
          sourceUrl: FOUND.status === "found" ? FOUND.capture.url : "",
          platform: "linkedin",
          sourceName: "Sam Sample",
        },
      },
    ]);
    expect(screen.getByRole("link", { name: "Open in your inbox" })).toHaveAttribute(
      "href",
      `${WEB}/inbox/capture-1`,
    );
  });

  it("can drop its link before saving", async () => {
    const requests = stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    await field();
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    fireEvent.click(screen.getByRole("button", { name: "Save to inbox" }));

    await screen.findByText("Saved to your inbox");
    expect(requests[0]?.input).toMatchObject({ sourceUrl: null, platform: "pasted" });
  });

  it("warns when it is over the limit", async () => {
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    fireEvent.change(await field(), { target: { value: "a".repeat(1_200) } });

    expect(screen.getByText("We keep the first 1,000 characters.")).toBeInTheDocument();
  });

  it("starts a fresh form when the next capture arrives", async () => {
    const { environment, capture } = createEnvironment(TOKEN, FOUND);
    renderPanel(environment);
    fireEvent.change(await field(), { target: { value: "Half-edited." } });

    act(() => {
      capture({
        ...FOUND,
        id: "two",
        status: "found",
        capture: { ...FOUND.capture, text: "Next." },
      });
    });

    await waitFor(async () => {
      expect(await field()).toHaveValue("Next.");
    });
  });
});

describe("a capture that found nothing", () => {
  it("asks the user to select the text, and saves what they type with the page's link", async () => {
    const requests = stubApi();
    renderPanel(
      createEnvironment(TOKEN, {
        id: "one",
        status: "empty",
        url: "https://www.linkedin.com/feed/",
        platform: "linkedin",
      }).environment,
    );

    expect(await screen.findByText(/Select the text you want/)).toBeInTheDocument();
    expect(await field()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save to inbox" })).toBeDisabled();

    fireEvent.change(await field(), { target: { value: "Typed by hand." } });
    fireEvent.click(screen.getByRole("button", { name: "Save to inbox" }));

    await screen.findByText("Saved to your inbox");
    expect(requests[0]?.input).toMatchObject({
      text: "Typed by hand.",
      sourceUrl: "https://www.linkedin.com/feed/",
      platform: "linkedin",
      sourceName: null,
    });
  });

  it("says when Chrome won't let the page be read", async () => {
    renderPanel(createEnvironment(TOKEN, { id: "one", status: "blocked" }).environment);

    expect(await screen.findByText(/doesn't let extensions read this page/)).toBeInTheDocument();
    expect(await field()).toBeEnabled();
  });
});

describe("a sign-in that has ended", () => {
  it("asks to sign in again and keeps the text", async () => {
    stubApi("signed-out");
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    await field();
    fireEvent.click(screen.getByRole("button", { name: "Save to inbox" }));

    expect(await screen.findByText(/Your sign-in has ended/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in on the website" })).toHaveAttribute(
      "href",
      `${WEB}/extension/connect`,
    );
    expect(await field()).toHaveValue("Consistancy beats talent.");
  });
});

describe("capturing another", () => {
  it("returns to waiting once the capture is saved and cleared", async () => {
    stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    await field();
    fireEvent.click(screen.getByRole("button", { name: "Save to inbox" }));
    fireEvent.click(await screen.findByRole("button", { name: "Capture another" }));

    expect(await screen.findByText("Spot something good?")).toBeInTheDocument();
  });
});
