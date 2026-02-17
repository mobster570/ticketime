import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  unit?: string;
  showValue?: boolean;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  className,
  label,
  description,
  unit,
  showValue = true,
  disabled,
  onChange,
  ...props
}: SliderProps) {
  const percentage =
    ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;

  return (
    <div className={cn("space-y-3", className)}>
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
      <div className="flex items-center gap-4">
        <div className="relative flex flex-1 items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={onChange}
            style={{
              background: `linear-gradient(to right, var(--color-accent) ${percentage}%, var(--color-border) ${percentage}%)`,
            }}
            className={cn(
              "h-2 w-full appearance-none rounded-full outline-none transition-all cursor-pointer",
              "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
              disabled && "cursor-not-allowed opacity-50",
              // Webkit thumb
              "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-1 [&::-webkit-slider-thumb]:ring-black/5 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
              // Firefox thumb
              "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-110",
            )}
            {...props}
          />
        </div>
        {showValue && (
          <span className="min-w-[3rem] text-center rounded-md bg-[var(--color-input-bg)] px-2 py-1 text-xs font-medium text-[var(--color-text-primary)] tabular-nums border border-[var(--color-border)]">
            {value}
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
