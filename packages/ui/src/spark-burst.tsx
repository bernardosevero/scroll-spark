"use client";

import { motion, useReducedMotion } from "motion/react";

import { DURATION } from "./motion-tokens";

const PIECES = [
  { x: 120, y: -130, size: 22, color: "var(--color-spark)", isRound: false },
  { x: -130, y: -110, size: 16, color: "var(--color-blue)", isRound: true },
  { x: 150, y: 30, size: 18, color: "var(--color-danger)", isRound: false },
  { x: -150, y: 50, size: 20, color: "var(--color-navy)", isRound: false },
  { x: 60, y: -190, size: 16, color: "var(--color-blue)", isRound: false },
  { x: -60, y: -200, size: 18, color: "var(--color-spark)", isRound: false },
  { x: 100, y: 150, size: 18, color: "var(--color-danger)", isRound: true },
  { x: -90, y: 170, size: 16, color: "var(--color-spark)", isRound: false },
] as const;

/**
 * The celebration when a post ships. Place it inside a `relative` parent. It takes no clicks and
 * shows nothing when someone asks for reduced motion, so the words beside it must carry the news.
 */
export function SparkBurst() {
  const isMotionReduced = useReducedMotion();

  if (isMotionReduced) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="spark-burst"
      className="pointer-events-none absolute top-1/2 left-1/2"
    >
      {PIECES.map(({ x, y, size, color, isRound }) => (
        <motion.span
          key={`${x},${y}`}
          className="absolute block"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            borderRadius: isRound ? "50%" : 0,
          }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
          animate={{ x, y, scale: 1.1, opacity: 0, rotate: 160 }}
          transition={{ duration: DURATION.celebration, ease: [0.15, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
