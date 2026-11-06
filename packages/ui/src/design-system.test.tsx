import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { FitRow } from "./fit-row";
import { SparkBurst } from "./spark-burst";
import { TextAreaField } from "./text-area-field";

function setReducedMotion(isReduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isReduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

describe("design system", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps a button from submitting forms unless asked", () => {
    render(<Button>Save idea</Button>);

    expect(screen.getByRole("button", { name: "Save idea" }).getAttribute("type")).toBe("button");
  });

  it("ties a field's label to its input", () => {
    render(<TextAreaField label="Captured text" />);

    expect(screen.getByLabelText("Captured text").tagName).toBe("TEXTAREA");
  });

  it.each([
    ["fits", "Fits LinkedIn"],
    ["new", "New for LinkedIn"],
  ] as const)("words the %s verdict", (verdict, words) => {
    render(<FitRow channel="LinkedIn" verdict={verdict} detail="2 posts" />);

    expect(screen.getByText(words)).toBeTruthy();
  });

  it("shows the burst normally", () => {
    setReducedMotion(false);
    render(<SparkBurst />);

    expect(screen.queryByTestId("spark-burst")).not.toBeNull();
  });
});
