import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@scroll-spark/api/client";
import { TRPCProvider } from "@scroll-spark/api/react";

import type { PendingCapture } from "../capture/pending-capture";
import type { StoredToken } from "../lib/connect-message";
import {
  ANALYSIS,
  CHANNELS_VIEW as CHANNELS,
  DRAFT,
  failure,
  stubApi,
} from "../test-support/fake-api";
import type { Answer } from "../test-support/fake-api";
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

function renderPanel(environment: PanelEnvironment) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
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
const click = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

/** Opens the panel on a found capture and presses "Find the spark". */
async function findTheSpark(answers: Record<string, Answer> = {}) {
  const api = stubApi(answers);
  renderPanel(createEnvironment(TOKEN, FOUND).environment);
  await field();
  click("Find the spark");

  return api;
}

/** Gets to the analysis card, then on to the stage the test is about. */
async function toTheAnalysis(answers: Record<string, Answer> = {}) {
  const api = await findTheSpark(answers);
  await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });

  return api;
}

async function toTheDraft(answers: Record<string, Answer> = {}) {
  const api = await toTheAnalysis(answers);
  click("Draft a post");
  await waitFor(() => {
    expect(screen.getByLabelText("Your draft")).toHaveValue(DRAFT.text);
  });

  return api;
}

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

describe("review", () => {
  it("shows the captured post for correction, then analyzes it as corrected, with the bearer token", async () => {
    const api = stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    expect(await field()).toHaveValue("Consistancy beats talent.");
    expect(screen.getByText("From Sam Sample")).toBeInTheDocument();

    fireEvent.change(await field(), { target: { value: "Consistency beats talent." } });
    click("Find the spark");

    await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });
    expect(api.calls.map(({ procedure }) => procedure)).toEqual([
      "capture.create",
      "capture.analyze",
    ]);
    expect(api.calls.every(({ authorization }) => authorization === "Bearer ssx_test")).toBe(true);
    expect(api.called("capture.create")[0]?.input).toEqual({
      text: "Consistency beats talent.",
      sourceUrl: FOUND.status === "found" ? FOUND.capture.url : "",
      platform: "linkedin",
      sourceName: "Sam Sample",
    });
    expect(api.called("capture.analyze")[0]?.input).toEqual({ captureId: "capture-1" });
  });

  it("can drop its link before analyzing", async () => {
    const api = stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    await field();
    click("Remove link");
    click("Find the spark");

    await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });
    expect(api.called("capture.create")[0]?.input).toMatchObject({
      sourceUrl: null,
      platform: "pasted",
    });
  });

  it("warns when it is over the limit", async () => {
    stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    fireEvent.change(await field(), { target: { value: "a".repeat(1_200) } });

    expect(screen.getByText("We keep the first 1,000 characters.")).toBeInTheDocument();
  });

  it("starts a fresh form when the next capture arrives", async () => {
    stubApi();
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

  it("asks the user to select text when the page gave none, and sends what they type with the page's link", async () => {
    const api = stubApi();
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
    expect(screen.getByRole("button", { name: "Find the spark" })).toBeDisabled();

    fireEvent.change(await field(), { target: { value: "Typed by hand." } });
    click("Find the spark");

    await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });
    expect(api.called("capture.create")[0]?.input).toMatchObject({
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
  it("asks to sign in again while saving, and keeps the text", async () => {
    stubApi({ "capture.create": failure("NOT_SIGNED_IN") });
    renderPanel(createEnvironment(TOKEN, FOUND).environment);

    await field();
    click("Find the spark");

    expect(await screen.findByText(/Your sign-in has ended/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in on the website" })).toHaveAttribute(
      "href",
      `${WEB}/extension/connect`,
    );
    expect(await field()).toHaveValue("Consistancy beats talent.");
  });

  it.each([
    ["the analysis", "capture.analyze"],
    ["saving the idea", "capture.saveAsIdea"],
    ["the draft", "draft.create"],
    ["posting", "post.create"],
  ])("asks to sign in again during %s", async (_stage, procedure) => {
    stubApi({ [procedure]: failure("NOT_SIGNED_IN") });
    renderPanel(createEnvironment(TOKEN, FOUND).environment);
    await field();
    click("Find the spark");

    if (procedure !== "capture.analyze") {
      await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });

      if (procedure === "capture.saveAsIdea") {
        click("Save idea");
      } else {
        click("Draft a post");
        await screen.findByLabelText("Your draft");

        if (procedure === "post.create") {
          await waitFor(() => {
            expect(screen.getByLabelText("Your draft")).toHaveValue(DRAFT.text);
          });
          click("Save as draft");
        }
      }
    }

    expect(await screen.findByText(/Your sign-in has ended/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in on the website" })).toHaveAttribute(
      "href",
      `${WEB}/extension/connect`,
    );
  });
});

describe("the analysis", () => {
  it("shows the topic, angle, fit per channel in counts and dates, and Trends links", async () => {
    await toTheAnalysis();

    expect(screen.getByText("Habits")).toBeInTheDocument();
    expect(screen.getByText(ANALYSIS.analysis.summary)).toBeInTheDocument();
    expect(screen.getByText("Fits Example Studio")).toBeInTheDocument();
    expect(screen.getByText(/3 posts, last posted Oct 2/)).toBeInTheDocument();
    expect(screen.getByText("You already have 1 idea on this.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "habits" })).toHaveAttribute(
      "href",
      "https://trends.google.com/trends/explore?q=habits",
    );
    expect(screen.getByRole("button", { name: "Save idea" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft a post" })).toBeInTheDocument();
  });

  it("points to the website when no channels are chosen, instead of picking them here", async () => {
    await toTheAnalysis({
      "capture.analyze": { ...ANALYSIS, analysis: { ...ANALYSIS.analysis, channels: null } },
    });

    expect(screen.getByRole("link", { name: "Choose your channels" })).toHaveAttribute(
      "href",
      `${WEB}/channels`,
    );
  });

  it("changes the Trends country through the API", async () => {
    const api = await toTheAnalysis();

    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "BR" } });

    await waitFor(() => {
      expect(api.called("settings.setTrendsGeo")[0]?.input).toEqual({ geo: "BR" });
    });
  });

  it("says it is finding the spark while it waits", async () => {
    stubApi();
    renderPanel(createEnvironment(TOKEN, FOUND).environment);
    await field();
    click("Find the spark");

    expect(await screen.findByText("Finding the spark…")).toBeInTheDocument();
  });
});

describe("saving the idea", () => {
  it("moves to Saved, then on to the draft", async () => {
    const api = await toTheAnalysis();

    click("Save idea");

    expect(await screen.findByText("Saved to Buffer Ideas")).toBeInTheDocument();
    expect(api.called("capture.saveAsIdea")[0]?.input).toEqual({ captureId: "capture-1" });

    click("Draft a post");

    expect(await screen.findByLabelText("Your draft")).toBeInTheDocument();
  });

  it("can capture another from the saved screen", async () => {
    await toTheAnalysis();
    click("Save idea");
    await screen.findByText("Saved to Buffer Ideas");

    click("Capture another");

    expect(await screen.findByText("Spot something good?")).toBeInTheDocument();
  });
});

describe("the draft", () => {
  it("is written for the default channel and named for it", async () => {
    const api = await toTheDraft();

    expect(screen.getByRole("heading", { name: /Draft for Example Studio/ })).toHaveTextContent(
      "Draft for Example Studio, in your usual language",
    );
    expect(screen.getByLabelText("Your draft")).toHaveValue(DRAFT.text);
    expect(screen.getByText("Written from your last 8 posts on this channel.")).toBeInTheDocument();
    expect(api.called("draft.create")[0]?.input).toEqual({
      captureId: "capture-1",
      channelId: "li",
      language: "same",
    });
  });

  it("names the language when one is chosen", async () => {
    const api = await toTheDraft();

    fireEvent.change(screen.getByLabelText("Write in"), { target: { value: "english" } });
    click("Write another draft");

    await waitFor(() => {
      expect(api.called("draft.create")).toHaveLength(2);
    });
    expect(api.called("draft.create")[1]?.input).toMatchObject({ language: "english" });
    expect(screen.getByRole("heading", { name: /Draft for/ })).toHaveTextContent(
      "Draft for Example Studio, in English",
    );
  });

  it("makes Save as draft the main action, and names the channel on the queue button", async () => {
    await toTheDraft();

    expect(screen.getByRole("button", { name: "Save as draft" }).className).toMatch(/bg-spark/);
    expect(screen.getByRole("button", { name: "Add to LinkedIn queue" }).className).not.toMatch(
      /bg-spark/,
    );
  });

  it("saves the edited text as a draft and moves to Done", async () => {
    const api = await toTheDraft();

    fireEvent.change(screen.getByLabelText("Your draft"), { target: { value: "My own words." } });
    click("Save as draft");

    expect(
      await screen.findByText("Saved as a draft in Buffer for Example Studio."),
    ).toBeInTheDocument();
    expect(api.called("post.create")[0]?.input).toEqual({
      captureId: "capture-1",
      channelId: "li",
      text: "My own words.",
      kind: "draft",
    });
    expect(screen.getByRole("button", { name: "Capture another" })).toBeInTheDocument();
  });

  it("adds to the queue only when asked, and says so", async () => {
    const api = await toTheDraft({
      "post.create": { postId: "post-1", kind: "queue", channelId: "li" },
    });

    click("Add to LinkedIn queue");

    expect(
      await screen.findByText("Added to the LinkedIn queue in Buffer for Example Studio."),
    ).toBeInTheDocument();
    expect(api.called("post.create")[0]?.input).toMatchObject({ kind: "queue" });
  });

  it("doesn't allow an empty or over-long post", async () => {
    await toTheDraft();

    fireEvent.change(screen.getByLabelText("Your draft"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Your draft"), { target: { value: "a".repeat(3_001) } });
    expect(screen.getByText(/That's 1 over/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to LinkedIn queue" })).toBeDisabled();
  });

  it("tells the user to choose an organization on the website when none is chosen", async () => {
    stubApi({
      "buffer.channels": { organizationId: null, channels: [], defaultChannelIds: [] },
    });
    renderPanel(createEnvironment(TOKEN, FOUND).environment);
    await field();
    click("Find the spark");
    await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });

    click("Draft a post");

    expect(await screen.findByRole("link", { name: "Choose your channels" })).toHaveAttribute(
      "href",
      `${WEB}/channels`,
    );
    expect(screen.queryByLabelText("Your draft")).toBeNull();
  });

  it("offers no choice when only one channel can be posted to, and never lists the others", async () => {
    await toTheDraft();

    expect(screen.queryByLabelText("Post to")).toBeNull();
    expect(screen.queryByText(/Studio on Instagram/)).toBeNull();
  });

  it("offers a choice among channels that can be posted to, and starts over for the one picked", async () => {
    const [linkedin] = CHANNELS.channels;
    const api = await toTheDraft({
      "buffer.channels": {
        ...CHANNELS,
        channels: [
          ...CHANNELS.channels,
          { ...linkedin, id: "x", service: "twitter", name: "Example on X" },
        ],
      },
    });

    const select = screen.getByLabelText("Post to");

    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Example Studio · LinkedIn", "Example on X · X"]);

    fireEvent.change(select, { target: { value: "x" } });

    await waitFor(() => {
      expect(api.called("draft.create")).toHaveLength(2);
    });
    expect(api.called("draft.create")[1]?.input).toMatchObject({ channelId: "x" });
    expect(screen.getByRole("button", { name: "Add to X queue" })).toBeInTheDocument();
  });
});

describe("done", () => {
  it("offers to capture another, which returns to waiting", async () => {
    await toTheDraft();
    click("Save as draft");
    await screen.findByText("Saved as a draft in Buffer for Example Studio.");

    click("Capture another");

    expect(await screen.findByText("Spot something good?")).toBeInTheDocument();
  });
});

describe("expected failures", () => {
  // Each code gets its own words, and the capture or the text the user typed stays on screen.
  it.each([
    ["LLM_REFUSED", /couldn't analyze this one/],
    ["ANALYSIS_LIMIT_REACHED", /today's limit reached/],
    ["BUFFER_RATE_LIMITED", /Buffer is busy/],
    ["RECONNECT_REQUIRED", /Buffer needs you to connect again/],
  ])("analyzing: %s", async (code, message) => {
    const api = await findTheSpark({ "capture.analyze": failure(code) });

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("Consistancy beats talent.")).toBeInTheDocument();
    expect(api.called("capture.create")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open in your inbox" })).toHaveAttribute(
      "href",
      `${WEB}/inbox/capture-1`,
    );
  });

  it("analyzing: a failed analysis can be tried again without saving the capture twice", async () => {
    let attempts = 0;
    const api = await findTheSpark({
      "capture.analyze": () => (attempts++ === 0 ? failure("LLM_REFUSED") : ANALYSIS),
    });
    await screen.findByRole("alert");

    click("Try again");

    await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });
    expect(api.called("capture.create")).toHaveLength(1);
  });

  it("analyzing: no trying again once today's limit is reached", async () => {
    await findTheSpark({ "capture.analyze": failure("ANALYSIS_LIMIT_REACHED") });
    await screen.findByRole("alert");

    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("saving the capture: a failure keeps the text and says so", async () => {
    stubApi({ "capture.create": failure("BUFFER_FAILED") });
    renderPanel(createEnvironment(TOKEN, FOUND).environment);
    await field();
    click("Find the spark");

    expect(await screen.findByRole("alert")).toHaveTextContent(/That didn't save/);
    expect(await field()).toHaveValue("Consistancy beats talent.");
  });

  it.each([
    ["BUFFER_LIMIT_REACHED", /plan has reached its limit for Ideas/],
    ["BUFFER_RATE_LIMITED", /Buffer is busy/],
    ["RECONNECT_REQUIRED", /Buffer needs you to connect again/],
    ["INVALID_INPUT", /Choose your Buffer organization/],
  ])("saving the idea: %s", async (code, message) => {
    await toTheAnalysis({ "capture.saveAsIdea": failure(code) });

    click("Save idea");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("heading", { name: ANALYSIS.analysis.angle })).toBeInTheDocument();
  });

  it("saving the idea: Reconnect Buffer goes to the website", async () => {
    await toTheAnalysis({ "capture.saveAsIdea": failure("RECONNECT_REQUIRED") });

    click("Save idea");

    expect(await screen.findByRole("link", { name: "Reconnect Buffer" })).toHaveAttribute(
      "href",
      `${WEB}/api/auth/connect`,
    );
  });

  it.each([
    ["LLM_REFUSED", /couldn't write a draft/],
    ["DRAFT_LIMIT_REACHED", /today's draft limit/],
    ["BUFFER_RATE_LIMITED", /Buffer is busy/],
    ["RECONNECT_REQUIRED", /Buffer needs you to connect again/],
  ])("drafting: %s leaves an empty editor to write in", async (code, message) => {
    stubApi({ "draft.create": failure(code) });
    renderPanel(createEnvironment(TOKEN, FOUND).environment);
    await field();
    click("Find the spark");
    await screen.findByRole("heading", { name: ANALYSIS.analysis.angle });
    click("Draft a post");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    fireEvent.change(screen.getByLabelText("Your draft"), { target: { value: "Mine." } });
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeEnabled();
  });

  it.each([
    ["BUFFER_LIMIT_REACHED", /plan has reached its limit for posts/],
    ["BUFFER_RATE_LIMITED", /Buffer is busy/],
    ["RECONNECT_REQUIRED", /Buffer needs you to connect again/],
    ["POST_TOO_LONG", /over this channel's limit/],
    ["CHANNEL_NOT_SUPPORTED", /can't be posted to from here/],
    ["BUFFER_FAILED", /couldn't confirm this reached Buffer/],
  ])("posting: %s keeps the text and never retries", async (code, message) => {
    const api = await toTheDraft({ "post.create": failure(code) });
    fireEvent.change(screen.getByLabelText("Your draft"), { target: { value: "Keep me." } });

    click("Add to LinkedIn queue");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Your draft")).toHaveValue("Keep me.");
    expect(api.called("post.create")).toHaveLength(1);
    expect(screen.queryByText("Capture another")).toBeNull();
  });
});
