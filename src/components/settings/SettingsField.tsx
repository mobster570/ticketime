import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SettingsFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsField({
  label,
  description,
  children,
  className,
}: SettingsFieldProps) {
  return (
    <div className={cn("flex items-center justify-between gap-6 py-5 first:pt-0 last:pb-0 group", className)}>
      <div className="flex flex-col gap-1.5 max-w-[60%]">
        <label className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors duration-200">
          {label}
        </label>
        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center justify-end min-w-[120px]">
        {children}
      </div>
    </div>
  );
}
