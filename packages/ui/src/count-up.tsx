"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { DURATION } from "./motion-tokens";

/**
 * A whole number that ticks up from zero and always ends on `to`. It eases out without an
 * overshoot, so it can never show a number above the real one. When someone asks for reduced
 * motion it shows `to` straight away.
 */
export function CountUp({
  to,
  delay = 0,
  duration = DURATION.everyday,
}: {
  to: number;
  /** Seconds before the count starts. */
  delay?: number;
  /** Seconds the count takes. */
  duration?: number;
}) {
  const isMotionReduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (isMotionReduced) {
      return;
    }

    const controls = animate(0, to, {
      delay,
      duration,
      ease: "easeOut",
      onUpdate: (latest) => {
        setValue(Math.min(to, Math.round(latest)));
      },
      onComplete: () => {
        setValue(to);
      },
    });

    return () => {
      controls.stop();
    };
  }, [delay, duration, isMotionReduced, to]);

  return <span className="tabular-nums">{isMotionReduced ? to : value}</span>;
}
