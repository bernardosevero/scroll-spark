/** Everyday transitions stay under 300 ms, celebrations under 800 ms. Seconds, as `motion` wants. */
export const DURATION = {
  everyday: 0.24,
  celebration: 0.72,
} as const;

/** A soft overshoot, so things land with a little bounce. */
export const EASE_SPARK = [0.3, 1.3, 0.5, 1] as const;
