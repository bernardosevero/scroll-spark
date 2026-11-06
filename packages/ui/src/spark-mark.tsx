/** The four-point spark. Decorative, so screen readers skip it; add words beside it. */
export function SparkMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className ?? "fill-spark"}
    >
      <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" />
    </svg>
  );
}
