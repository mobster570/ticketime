import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border-none px-4 py-3 text-sm transition-colors",
        "bg-[var(--color-input-bg)]",
        "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}
