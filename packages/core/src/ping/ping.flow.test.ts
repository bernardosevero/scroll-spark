import { describe, expect, it } from "vitest";

import type { AppError } from "../errors/app-error";
import { createPingService } from "./ping.service";

const fixedClock = { now: () => new Date("2026-11-06T12:00:00.000Z") };

describe("ping flow", () => {
  it("answers with the caller's name and the time it was asked", () => {
    const service = createPingService({ clock: fixedClock });

    expect(service.ping({ name: "website" })).toEqual({
      message: "pong, website",
      answeredAt: "2026-11-06T12:00:00.000Z",
    });
  });

  it.each(["", "   "])("refuses a blank name (%j) as invalid input", (name) => {
    const service = createPingService({ clock: fixedClock });

    expect(() => service.ping({ name })).toThrow(
      expect.objectContaining<Partial<AppError>>({ code: "INVALID_INPUT" }),
    );
  });
});
