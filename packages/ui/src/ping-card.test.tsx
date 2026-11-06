import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PingCard } from "./ping-card";
import type { PingCardProps } from "./ping-card";

describe("PingCard", () => {
  afterEach(cleanup);

  it.each<[PingCardProps, string]>([
    [{ status: "loading" }, "Looking for a spark…"],
    [{ status: "error" }, "The API didn't answer."],
    [{ status: "ready", message: "pong, website" }, "pong, website"],
  ])("shows the right words for %j", (props, words) => {
    render(<PingCard {...props} />);

    expect(screen.getByRole("status").textContent).toContain(words);
  });
});
