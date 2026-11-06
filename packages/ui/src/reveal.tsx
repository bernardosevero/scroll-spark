"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { DURATION, EASE_SPARK } from "./motion-tokens";

/** Rises content into place. People who ask for reduced motion see it arrive still. */
export function Reveal({ children }: { children: ReactNode }) {
  const isMotionReduced = useReducedMotion();

  return (
    <motion.div
      initial={isMotionReduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DURATION.everyday, ease: EASE_SPARK }}
    >
      {children}
    </motion.div>
  );
}
