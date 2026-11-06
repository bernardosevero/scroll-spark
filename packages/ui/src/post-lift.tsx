"use client";

import { motion, useReducedMotion } from "motion/react";

import { DURATION, EASE_SPARK } from "./motion-tokens";
import { SparkMark } from "./spark-mark";

/** The spark pops just after the post lifts, and finishes with it. */
const SPARK_DELAY = 0.1;

/**
 * Capture: a copy of the post lifts off the page, with a small spark. Place it in a `relative`
 * parent, over the field the post came from, and pass `isLifting` only once the capture is really
 * saved. It never holds up the next page. With reduced motion it shows nothing.
 */
export function PostLift({ isLifting, text }: { isLifting: boolean; text: string }) {
  const isMotionReduced = useReducedMotion();

  if (!isLifting || isMotionReduced) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="post-lift"
      className="pointer-events-none absolute inset-x-0 bottom-0"
    >
      <motion.div
        className="relative rounded-print border-[3px] border-navy bg-paper p-3 text-navy"
        style={{ boxShadow: "4px 4px 0 var(--color-spark)" }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [0, -14, -90, -120],
          scale: [1, 1.04, 0.94, 0.9],
          rotate: [0, -2.5, -4, -5],
        }}
        transition={{ duration: DURATION.celebration, times: [0, 0.15, 0.6, 1], ease: EASE_SPARK }}
      >
        <p className="line-clamp-2 wrap-anywhere whitespace-pre-line">{text}</p>
        <motion.span
          className="absolute -top-4 -right-3 inline-flex"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1, 0.7], opacity: [0, 1, 1, 0], rotate: [0, 0, 20, 45] }}
          transition={{
            duration: DURATION.celebration - SPARK_DELAY,
            delay: SPARK_DELAY,
            times: [0, 0.25, 0.6, 1],
          }}
        >
          <SparkMark size={28} />
        </motion.span>
      </motion.div>
    </div>
  );
}
