import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled,
  className,
  label,
  description,
  ...props
}: ToggleProps) {
  return (
    <label
      className={cn(
        "flex min-h-[44px] items-center justify-between gap-4 rounded-xl",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {description}
            </span>
          )}
        </div>
      )}
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
        <div
          className={cn(
            "h-6 w-11 rounded-full transition-colors duration-200 ease-in-out",
            checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg-primary)]",
          )}
        />
        <span
          className={cn(
            "absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out will-change-transform",
            checked ? "translate-x-[20px]" : "translate-x-0",
          )}
        />
      </div>
    </label>
  );
}
