import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  disabled,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={cn("relative overflow-hidden transition-all duration-200", className)}>
      <div className="flex items-start gap-4 mb-6">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-card-border)]">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="space-y-1 pt-0.5">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>
      </div>
      
      <div className={cn("space-y-1 divide-y divide-[var(--color-border)]", disabled && "opacity-20 pointer-events-none filter blur-[1px]")}>
        {children}
      </div>

      {disabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-card)]/40 backdrop-blur-[2px]">
          <span className="inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/20 shadow-sm">
            Coming Soon
          </span>
        </div>
      )}
    </Card>
  );
}
