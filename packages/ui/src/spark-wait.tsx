"use client";

import { motion, useReducedMotion } from "motion/react";

import { DURATION, EASE_SPARK } from "./motion-tokens";
import { SparkMark } from "./spark-mark";

export interface WaitStep {
  label: string;
  /** True only for something the app really knows is finished. Never a guess. */
  isDone: boolean;
}

function Tick() {
  return (
    <motion.span
      aria-hidden="true"
      className="inline-flex size-5 items-center justify-center rounded-full bg-navy"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: DURATION.everyday, ease: EASE_SPARK }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-white">
        <path d="M2 6.5 L5 9 L10 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.span>
  );
}

/**
 * Waiting for the AI: a turning spark beside the step in progress, and a tick for each step
 * that has really finished. The steps are the caller's to report, so nothing here pretends to
 * know how far along the wait is. With reduced motion the spark stays out, and the words remain.
 */
export function SparkWait({ steps }: { steps: WaitStep[] }) {
  const isMotionReduced = useReducedMotion();
  const activeIndex = steps.findIndex(({ isDone }) => !isDone);

  return (
    <div role="status">
      <ol className="flex flex-col gap-3">
        {steps.map(({ label, isDone }, index) =>
          index === activeIndex ? (
            <li key={label} aria-current="step" className="flex items-center gap-3">
              {!isMotionReduced && (
                <span
                  aria-hidden="true"
                  data-testid="spark-wait"
                  className="pointer-events-none inline-flex"
                >
                  <motion.span
                    className="inline-flex"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                  >
                    <SparkMark size={36} />
                  </motion.span>
                </span>
              )}
              <span className="font-display text-3xl font-extrabold">{label}</span>
            </li>
          ) : (
            <li key={label} className="flex items-center gap-3 text-sm font-medium">
              {isDone && (
                <>
                  <Tick />
                  <span className="sr-only">Done: </span>
                </>
              )}
              <span>{label}</span>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
