import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** The pink offset, for the one card a screen is about. */
  isFeatured?: boolean;
}

export function Card({ isFeatured = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-print border-[3px] border-navy bg-paper p-6 text-navy ${isFeatured ? "shadow-offset-spark" : ""} ${className}`}
      {...props}
    />
  );
}
