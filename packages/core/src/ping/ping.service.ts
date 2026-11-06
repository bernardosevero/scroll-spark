import { AppError } from "../errors/app-error";
import type { Clock } from "../time/clock";
import type { PingInput, PingOutput } from "./schemas";

export interface PingService {
  ping(input: PingInput): PingOutput;
}

/**
 * The tracer through every layer. Copy its shape for a real feature: a factory that receives its
 * dependencies, schemas beside it, and a flow test that went red first.
 */
export function createPingService({ clock }: { clock: Clock }): PingService {
  return {
    ping({ name }) {
      if (name.trim() === "") {
        throw new AppError("INVALID_INPUT");
      }

      return { message: `pong, ${name}`, answeredAt: clock.now().toISOString() };
    },
  };
}
