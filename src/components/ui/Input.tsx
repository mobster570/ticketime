import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
        "bg-[var(--color-input-bg)] border-[var(--color-input-border)]",
        "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent",
        className,
      )}
      {...props}
    />
  );
}
