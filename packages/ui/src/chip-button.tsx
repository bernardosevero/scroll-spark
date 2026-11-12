import type { ButtonHTMLAttributes } from "react";

/** A small pill action, like a suggestion to try. For the one main action, use `Button`. */
export function ChipButton({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-navy bg-paper px-4 font-medium text-navy transition duration-100 hover:bg-cream disabled:cursor-not-allowed disabled:bg-stone motion-reduce:transition-none ${className}`}
      {...props}
    />
  );
}
