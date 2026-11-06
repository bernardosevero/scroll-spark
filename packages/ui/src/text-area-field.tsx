import { useId } from "react";
import type { ComponentProps } from "react";

export interface TextAreaFieldProps extends ComponentProps<"textarea"> {
  label: string;
}

export function TextAreaField({ label, className = "", ...props }: TextAreaFieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <textarea
        id={id}
        className={`min-h-44 resize-y rounded-print border-[3px] border-navy bg-paper p-3.5 text-navy ${className}`}
        {...props}
      />
    </div>
  );
}
