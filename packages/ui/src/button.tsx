import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  /** The one main action on a screen. */
  spark: "bg-spark text-paper",
  /** Every other action. */
  plain: "bg-paper text-navy",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

/** Printed block that presses into the page. The shadow is the depth, so it shrinks on press. */
export function Button({
  variant = "spark",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`min-h-14 rounded-print border-[3px] border-navy px-5 text-lg font-bold shadow-offset-navy transition duration-100 hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--color-navy)] disabled:translate-0 disabled:cursor-not-allowed disabled:bg-stone disabled:text-navy disabled:shadow-none motion-reduce:transition-none ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
