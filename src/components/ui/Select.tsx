import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  label?: string;
  description?: string;
}

export function Select({
  options,
  className,
  label,
  description,
  disabled,
  ...props
}: SelectProps) {
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
        <select
          disabled={disabled}
          className={cn(
            "w-full appearance-none rounded-xl border-none px-4 py-3 pr-10 text-sm transition-colors cursor-pointer",
            "bg-[var(--color-input-bg)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]",
            disabled && "cursor-not-allowed opacity-50",
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={cn(
            "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none",
            "text-[var(--color-text-secondary)]"
          )}
        />
      </div>
    </div>
  );
}
