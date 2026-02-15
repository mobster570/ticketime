import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-[var(--color-bg-card)] border-[var(--color-border)] p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
