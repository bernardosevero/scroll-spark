import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, ButtonLink } from "./button";
import { ChipButton } from "./chip-button";
import { FitRow } from "./fit-row";
import { ReconnectNotice } from "./reconnect-notice";
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

  it("centers a link button's label, as a button does, so a stack of both lines up", () => {
    render(<ButtonLink href="/inbox">Open in your inbox</ButtonLink>);

    const link = screen.getByRole("link", { name: "Open in your inbox" });
    expect(link.className).toContain("justify-center");
    expect(link.className).toContain("text-center");
  });

  it("shows a pointer over buttons and chips, and not over a disabled one", () => {
    render(
      <>
        <Button>Save idea</Button>
        <ChipButton>A founder story</ChipButton>
      </>,
    );

    const button = screen.getByRole("button", { name: "Save idea" });
    expect(button.className).toContain("cursor-pointer");
    expect(button.className).toContain("disabled:cursor-not-allowed");
    expect(screen.getByRole("button", { name: "A founder story" }).className).toContain(
      "cursor-pointer",
    );
  });

  it("keeps a button from submitting forms unless asked", () => {
    render(<Button>Save idea</Button>);

    expect(screen.getByRole("button", { name: "Save idea" }).getAttribute("type")).toBe("button");
  });

  it("keeps a chip from submitting forms unless asked", () => {
    render(<ChipButton>A founder story</ChipButton>);

    expect(screen.getByRole("button", { name: "A founder story" }).getAttribute("type")).toBe(
      "button",
    );
  });

  it("lets a field take focus from its parent", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<TextAreaField label="Captured text" ref={ref} />);

    expect(ref.current).toBe(screen.getByLabelText("Captured text"));
  });

  it("ties a field's label to its input", () => {
    render(<TextAreaField label="Captured text" />);

    expect(screen.getByLabelText("Captured text").tagName).toBe("TEXTAREA");
  });

  it.each([
    ["fits", "Fits LinkedIn"],
    ["new", "New for LinkedIn"],
    ["unclear", "LinkedIn"],
  ] as const)("words the %s verdict", (verdict, words) => {
    render(<FitRow channel="LinkedIn" verdict={verdict} detail="2 posts" />);

    expect(screen.getByText(words)).toBeTruthy();
  });

  it("announces the reconnect notice and links to the connect flow", () => {
    render(<ReconnectNotice href="/api/auth/connect" />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reconnect Buffer" }).getAttribute("href")).toBe(
      "/api/auth/connect",
    );
  });

  it("shows the burst normally", () => {
    setReducedMotion(false);
    render(<SparkBurst />);

    expect(screen.queryByTestId("spark-burst")).not.toBeNull();
  });
});
