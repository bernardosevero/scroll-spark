"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { CountUp } from "./count-up";
import { DURATION, EASE_SPARK } from "./motion-tokens";

const MAX_SHEETS = 3;
/** Rows start a little apart, but never so late that the whole reveal runs past 800 ms. */
const ROW_STAGGER = 0.07;
const MAX_STAGGERED_ROWS = 3;
const SHEET_DURATION = 0.4;
const SHEET_STAGGER = 0.04;
const COUNT_DELAY = 0.14;
const COUNT_DURATION = 0.4;

function fanAngles(sheets: number) {
  if (sheets === 1) {
    return [0];
  }

  return sheets === 2 ? [-9, 9] : [-14, 0, 14];
}

export interface FitRevealProps {
  /** How many of the channel's posts match. This is the real count, and the fan ends on it. */
  matchCount: number;
  /** The row's place in the list, so the rows fan out one after another. */
  index: number;
  /** The row's words. They carry the news on their own. */
  children: ReactNode;
}

/**
 * The fit reveal: the posts that match fan out beside a channel's row, and their count ticks up.
 * The fan is decoration only, so the row's words must say everything, and people who ask for
 * reduced motion get the row alone.
 */
export function FitReveal({ matchCount, index, children }: FitRevealProps) {
  const isMotionReduced = useReducedMotion();

  if (isMotionReduced) {
    return <>{children}</>;
  }

  const rowDelay = Math.min(index, MAX_STAGGERED_ROWS) * ROW_STAGGER;
  const angles = fanAngles(Math.min(matchCount, MAX_SHEETS));

  return (
    <div className="flex items-start gap-3">
      <div className="h-12 w-14 shrink-0">
        {matchCount > 0 && (
          <div
            aria-hidden="true"
            data-testid="fit-reveal"
            className="pointer-events-none relative h-12 w-14"
          >
            {angles.map((angle, sheet) => (
              <motion.span
                key={angle}
                className="absolute top-1 left-3 block h-10 w-8 rounded-[3px] border-2 border-navy bg-paper"
                style={{ transformOrigin: "50% 100%" }}
                initial={{ opacity: 0, y: 6, x: 0, rotate: 0, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, x: angle / 2, rotate: angle, scale: 1 }}
                transition={{
                  duration: SHEET_DURATION,
                  delay: rowDelay + sheet * SHEET_STAGGER,
                  ease: EASE_SPARK,
                }}
              >
                <span className="mt-1.5 ml-1 block h-0.5 w-4 bg-navy/40" />
                <span className="mt-1 ml-1 block h-0.5 w-3 bg-navy/40" />
              </motion.span>
            ))}
            <motion.span
              className="absolute right-0 bottom-0 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-navy bg-spark px-1 text-xs font-bold text-white"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: DURATION.everyday,
                delay: rowDelay + COUNT_DELAY,
                ease: EASE_SPARK,
              }}
            >
              <CountUp to={matchCount} delay={rowDelay + COUNT_DELAY} duration={COUNT_DURATION} />
            </motion.span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
