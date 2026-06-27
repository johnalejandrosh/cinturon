"use client";

import type { ReactNode } from "react";
import { useCountUp } from "@/shared/hooks/use-count-up";
import { cn } from "@/shared/lib/cn";

interface KpiCardProps {
  label: string;
  icon: ReactNode;
  /** Numeric value to animate toward. */
  value: number;
  /** Formats the animated value for display. */
  display: (n: number) => string;
  hint?: string;
  /** Override accent colour (e.g. the risk gradient). Defaults to cyan. */
  accentColor?: string;
  /** 0–100 progress bar (used by the risk index). */
  progress?: number;
}

export function KpiCard({
  label,
  icon,
  value,
  display,
  hint,
  accentColor,
  progress,
}: KpiCardProps) {
  const animated = useCountUp(value);
  const color = accentColor ?? "var(--color-accent)";

  return (
    <article className="kpi-card animate-rise group">
      {/* Glow accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span style={{ color }} className="opacity-80">
          {icon}
        </span>
      </div>

      <p
        className="data-num mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
        style={{ color }}
      >
        {display(animated)}
      </p>

      {progress != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, Math.min(100, progress))}%`, background: color }}
          />
        </div>
      )}

      {hint && <p className={cn("mt-2 text-xs text-zinc-400")}>{hint}</p>}
    </article>
  );
}
