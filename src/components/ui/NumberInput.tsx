import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  unit?: string;
}

export function NumberInput({
  className,
  label,
  description,
  unit,
  disabled,
  ...props
}: NumberInputProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              {label}
            </label>
          )}
          {description && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {description}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="number"
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border-none py-3 text-sm transition-colors",
            "bg-[var(--color-input-bg)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]",
            "pl-4", // Left padding
            unit ? "pr-12" : "pr-4", // Right padding space for unit
            disabled && "cursor-not-allowed opacity-50",
          )}
          {...props}
        />
        {unit && (
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4",
              "text-sm text-[var(--color-text-secondary)]"
            )}
          >
            {unit}
          </div>
        )}
      </div>
    </div>
  );
}
