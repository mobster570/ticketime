import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-card-border)] bg-[var(--color-bg-card)] p-6",
        className,
      )}
      {...props}
    />
  );
}
