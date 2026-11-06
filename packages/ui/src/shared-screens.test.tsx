import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisCard } from "./analysis-card";
import { DraftEditorView } from "./draft-editor-view";
import type { DraftEditorViewProps } from "./draft-editor-view";
import { FitCheck } from "./fit-check";
import { TrendsLinks } from "./trends-links";

afterEach(cleanup);

describe("analysis card", () => {
  it("shows the topic, angle and summary, with the angle as the heading", () => {
    render(
      <AnalysisCard
        status="ready"
        topic="Customer feedback"
        angle="The quiet customer who changed what you built"
        summary="A founder learns from one sentence."
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "The quiet customer who changed what you built",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Customer feedback")).toBeTruthy();
    expect(screen.getByText("A founder learns from one sentence.")).toBeTruthy();
  });

  it("can sit lower in a page's outline", () => {
    render(<AnalysisCard status="ready" topic="t" angle="An angle" summary="s" headingLevel={2} />);

    expect(screen.getByRole("heading", { level: 2, name: "An angle" })).toBeTruthy();
  });

  it("says it is finding the spark while it waits", () => {
    render(<AnalysisCard status="finding" />);

    expect(screen.getByRole("status").textContent).toBe("Finding the spark…");
  });

  it("announces a failure, and shows the action beside it", () => {
    render(
      <AnalysisCard status="failed" message="That didn't work.">
        <button>Try again</button>
      </AnalysisCard>,
    );

    expect(screen.getByRole("alert").textContent).toBe("That didn't work.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("fit check", () => {
  it("lists a row per channel with counts and dates, and the duplicate note", () => {
    render(
      <FitCheck
        rows={[
          { channel: "LinkedIn", verdict: "fits", detail: "3 posts, last posted Oct 2" },
          { channel: "X", verdict: "new", detail: "No posts on this topic" },
        ]}
        duplicateNote="You saved 1 Idea about this."
      />,
    );

    const section = screen.getByRole("region", { name: "How it fits your channels" });

    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
    expect(within(section).getByText("Fits LinkedIn")).toBeTruthy();
    expect(within(section).getByText("New for X")).toBeTruthy();
    expect(within(section).getByText("You saved 1 Idea about this.")).toBeTruthy();
  });

  it("says there is no fit check yet when there are no rows, with the action it was given", () => {
    render(<FitCheck rows={[]} duplicateNote={null} emptyAction={<a href="/channels">Pick</a>} />);

    expect(screen.getByText(/no fit check for this one yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Pick" })).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("trends links", () => {
  const base = {
    links: [{ phrase: "customer feedback", url: "https://trends.google.com/a" }],
    compareUrl: "https://trends.google.com/compare",
    geo: "US",
    isSaving: false,
    hasError: false,
  };

  it("links each phrase and the comparison, and reports a country change", () => {
    const onGeoChange = vi.fn();
    render(<TrendsLinks {...base} onGeoChange={onGeoChange} />);

    expect(screen.getByRole("link", { name: "customer feedback" }).getAttribute("href")).toBe(
      "https://trends.google.com/a",
    );
    expect(screen.getByRole("link", { name: "Compare all" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "BR" } });

    expect(onGeoChange).toHaveBeenCalledWith("BR");
  });

  it("says when the country did not save, and locks the field while saving", () => {
    render(<TrendsLinks {...base} compareUrl={null} isSaving hasError onGeoChange={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toMatch(/didn't save/);
    expect(screen.getByLabelText("Country")).toHaveProperty("disabled", true);
    expect(screen.queryByRole("link", { name: "Compare all" })).toBeNull();
  });
});

describe("draft editor", () => {
  const base: DraftEditorViewProps = {
    toolbar: <button>Write a draft</button>,
    voiceNote: null,
    text: "My draft.",
    onTextChange: vi.fn(),
    count: 9,
    limit: 3000,
    isCloseToSource: false,
    serviceLabel: "LinkedIn",
    isBlocked: false,
    isSending: false,
    sentKind: null,
    sentMessage: null,
    error: null,
    onSend: vi.fn(),
  };

  it("makes Save as draft the main action, and names the channel on the queue button", () => {
    render(<DraftEditorView {...base} />);

    expect(screen.getByRole("button", { name: "Save as draft" }).className).toMatch(/bg-spark/);
    const queue = screen.getByRole("button", { name: "Add to LinkedIn queue" });

    expect(queue.className).not.toMatch(/bg-spark/);
  });

  it("sends the kind the user chose", () => {
    const onSend = vi.fn();
    render(<DraftEditorView {...base} onSend={onSend} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to LinkedIn queue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(onSend.mock.calls).toEqual([["queue"], ["draft"]]);
  });

  it("counts characters against the limit and ties the count to the field", () => {
    render(<DraftEditorView {...base} />);

    expect(screen.getByLabelText("Your draft").getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("9 of 3000 characters")).toBeTruthy();
  });

  it("says how far over the limit it is, and will not send", () => {
    render(<DraftEditorView {...base} count={3005} isBlocked />);

    expect(screen.getByText(/That's 5 over/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as draft" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Add to LinkedIn queue" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows no limit for a service without one", () => {
    render(<DraftEditorView {...base} limit={null} />);

    expect(screen.getByText("9 characters")).toBeTruthy();
  });

  it("holds both buttons while it sends, so a post is never sent twice", () => {
    render(<DraftEditorView {...base} isSending />);

    expect(screen.getByRole("status").textContent).toBe("Sending it to Buffer…");
    expect(screen.getByRole("button", { name: "Save as draft" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Add to LinkedIn queue" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("confirms what was sent and locks the button that sent it", () => {
    render(
      <DraftEditorView {...base} sentKind="queue" sentMessage="Added to the LinkedIn queue." />,
    );

    expect(screen.getByText("Added to the LinkedIn queue.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to LinkedIn queue" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Save as draft" })).toHaveProperty("disabled", false);
  });

  it("keeps the text when an error is shown", () => {
    render(<DraftEditorView {...base} error={<p role="alert">Buffer is busy.</p>} />);

    expect(screen.getByRole("alert").textContent).toBe("Buffer is busy.");
    expect(screen.getByLabelText("Your draft")).toHaveProperty("value", "My draft.");
  });

  it("shows the voice note under its question, and warns about close wording", () => {
    render(
      <DraftEditorView {...base} voiceNote="Written from your last 8 posts." isCloseToSource />,
    );

    expect(screen.getByRole("heading", { name: "Sounds like you?" })).toBeTruthy();
    expect(screen.getByText("Written from your last 8 posts.")).toBeTruthy();
    expect(screen.getByText(/close to the post you captured/)).toBeTruthy();
  });

  it("reports edits", () => {
    const onTextChange = vi.fn();
    render(<DraftEditorView {...base} onTextChange={onTextChange} />);

    fireEvent.change(screen.getByLabelText("Your draft"), { target: { value: "New." } });

    expect(onTextChange).toHaveBeenCalledWith("New.");
  });
});
