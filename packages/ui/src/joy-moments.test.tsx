import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountUp } from "./count-up";
import { FitReveal } from "./fit-reveal";
import { IdeaFlight } from "./idea-flight";
import { PostLift } from "./post-lift";
import { SparkBurst } from "./spark-burst";
import { SparkWait } from "./spark-wait";

// `motion` reads the preference once per page, so tests that flip it replace the hook instead.
let isReducedNow = false;

vi.mock("motion/react", async (importOriginal) => {
  const original: Record<string, unknown> = await importOriginal();

  return { ...original, useReducedMotion: () => isReducedNow };
});

function setReducedMotion(isReduced: boolean) {
  isReducedNow = isReduced;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isReduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

const STEPS = [
  { label: "Saved to your inbox", isDone: true },
  { label: "Finding the spark…", isDone: false },
];

/** Each moment, how to show it playing, the words that must survive without it, and its layer. */
const MOMENTS: [string, () => ReactNode, string, string][] = [
  [
    "fit reveal",
    () => (
      <FitReveal matchCount={3} index={0}>
        <b>Fits Example Studio</b>
      </FitReveal>
    ),
    "Fits Example Studio",
    "fit-reveal",
  ],
  ["waiting", () => <SparkWait steps={STEPS} />, "Finding the spark…", "spark-wait"],
  [
    "save idea",
    () => (
      <IdeaFlight shouldFly>
        <p>Saved to Buffer Ideas</p>
      </IdeaFlight>
    ),
    "Saved to Buffer Ideas",
    "idea-flight",
  ],
  ["capture", () => <PostLift isLifting text="A post worth keeping" />, "", "post-lift"],
  ["queued", () => <SparkBurst />, "", "spark-burst"],
];

describe("the joy moments", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(MOMENTS)(
    "%s: its decoration takes no clicks and is hidden from readers",
    (_, show, __, layer) => {
      setReducedMotion(false);
      render(show());

      const element = screen.getByTestId(layer);
      expect(element.getAttribute("aria-hidden")).toBe("true");
      expect(element.className).toContain("pointer-events-none");
    },
  );

  it.each(MOMENTS)(
    "%s: with reduced motion the words stay and no animated layer shows",
    (_, show, words, layer) => {
      setReducedMotion(true);
      render(show());

      expect(screen.queryByTestId(layer)).toBeNull();

      if (words !== "") {
        expect(screen.getByText(words)).toBeTruthy();
      }
    },
  );

  it("a count ends on exactly the number it was given", async () => {
    setReducedMotion(false);
    render(<CountUp to={7} />);

    await waitFor(() => {
      expect(screen.getByText("7")).toBeTruthy();
    });
  });

  it("a count shows its number at once when motion is reduced", () => {
    setReducedMotion(true);
    render(<CountUp to={12} />);

    expect(screen.getByText("12")).toBeTruthy();
  });

  it("a count of zero stays zero", async () => {
    setReducedMotion(false);
    render(<CountUp to={0} />);

    await waitFor(() => {
      expect(screen.getByText("0")).toBeTruthy();
    });
  });

  it("the fan counts the real number of matching posts and ends on it", async () => {
    setReducedMotion(false);
    render(
      <FitReveal matchCount={3} index={1}>
        <b>Fits Example Studio</b>
      </FitReveal>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fit-reveal").textContent).toBe("3");
    });
  });

  it("a row with no matching posts has nothing to fan out", () => {
    setReducedMotion(false);
    render(
      <FitReveal matchCount={0} index={0}>
        <b>New for studio.example.com</b>
      </FitReveal>,
    );

    expect(screen.queryByTestId("fit-reveal")).toBeNull();
    expect(screen.getByText("New for studio.example.com")).toBeTruthy();
  });

  it("the idea doesn't fly until it is really saved", () => {
    setReducedMotion(false);
    render(
      <IdeaFlight shouldFly={false}>
        <p>Save as idea</p>
      </IdeaFlight>,
    );

    expect(screen.queryByTestId("idea-flight")).toBeNull();
    expect(screen.getByText("Save as idea")).toBeTruthy();
  });

  it("the post doesn't lift until it is really saved", () => {
    setReducedMotion(false);
    render(<PostLift isLifting={false} text="A post worth keeping" />);

    expect(screen.queryByTestId("post-lift")).toBeNull();
  });

  it("waiting says which step it is on and which are done, in words", () => {
    setReducedMotion(true);
    render(<SparkWait steps={STEPS} />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Saved to your inbox").closest("li")?.textContent).toContain("Done");
    expect(screen.getByText("Finding the spark…").closest("li")?.getAttribute("aria-current")).toBe(
      "step",
    );
  });
});
