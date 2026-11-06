import type { AnchorHTMLAttributes } from "react";

/** A small pill link, such as a Google Trends phrase. Opens beside the page. */
export function ChipLink({ className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-11 items-center rounded-full border-2 border-navy bg-paper px-4 font-medium text-navy transition duration-100 hover:bg-cream motion-reduce:transition-none ${className}`}
      {...props}
    />
  );
}
