"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { DURATION, EASE_SPARK } from "./motion-tokens";

const FLIGHT_DURATION = 0.5;
const FLIGHT_DELAY = 0.06;

/** The little Ideas pile exists only inside this animation, then it tidies itself away. */
function Flight() {
  return (
    <div
      aria-hidden="true"
      data-testid="idea-flight"
      className="pointer-events-none absolute top-1/2 left-full -mt-5 ml-3 h-10 w-12"
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.85, 1, 1, 1.14, 1] }}
        transition={{ duration: DURATION.celebration, times: [0, 0.15, 0.6, 0.75, 1] }}
      >
        <span className="absolute bottom-0 left-1 block h-8 w-9 -rotate-3 rounded-[3px] border-2 border-navy bg-stone" />
        <span className="absolute right-1 bottom-0 block h-8 w-9 rotate-3 rounded-[3px] border-2 border-navy bg-stone" />
        <span className="absolute inset-x-0 bottom-0 block h-3 rounded-[3px] border-2 border-navy bg-paper" />
      </motion.div>
      <motion.span
        className="absolute bottom-2 left-2 block h-10 w-8 rounded-[3px] border-2 border-navy bg-paper"
        style={{ boxShadow: "3px 3px 0 var(--color-spark)" }}
        initial={{ x: -120, y: -100, rotate: -14, scale: 2, opacity: 1 }}
        animate={{ x: 0, y: -2, rotate: 3, scale: 0.8, opacity: [1, 1, 0] }}
        transition={{
          duration: FLIGHT_DURATION,
          delay: FLIGHT_DELAY,
          ease: EASE_SPARK,
          opacity: {
            duration: FLIGHT_DURATION,
            delay: FLIGHT_DELAY,
            times: [0, 0.85, 1],
            ease: "linear",
          },
        }}
      />
    </div>
  );
}

/**
 * Save idea: a small copy of the card flies into an Ideas pile once the idea is really saved.
 * Pass `shouldFly` only after the save succeeded. People who ask for reduced motion get the
 * children alone, so the words must carry the news.
 */
export function IdeaFlight({ shouldFly, children }: { shouldFly: boolean; children: ReactNode }) {
  const isMotionReduced = useReducedMotion();

  return (
    <div className="relative w-fit">
      {children}
      {shouldFly && !isMotionReduced && <Flight />}
    </div>
  );
}
