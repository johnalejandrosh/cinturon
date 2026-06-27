"use client";

import { useState } from "react";
import type { ClassBucket } from "../../../domain/ports";
import type { AsteroidFilters } from "../../../domain/filters";
import { classLabel } from "../../../domain/asteroid";
import { formatInt } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import { useFilterNavigation } from "../../hooks/use-filter-navigation";

/**
 * Horizontal distribution of bodies per orbital class. Bars use a square-root
 * scale so rare classes stay visible next to the dominant main belt. Clicking a
 * bar toggles that class in the URL filters.
 */
export function ClassDistribution({
  buckets,
  filters,
}: {
  buckets: ClassBucket[];
  filters: AsteroidFilters;
}) {
  const { commit } = useFilterNavigation();
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  const toggle = (code: string) => {
    const has = filters.classes.includes(code);
    const classes = has
      ? filters.classes.filter((c) => c !== code)
      : [...filters.classes, code];
    commit({ ...filters, classes });
  };

  if (buckets.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Sin datos de clasificación.</p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {buckets.map((b) => {
        const active = filters.classes.includes(b.className);
        const width = Math.max(3, Math.sqrt(b.count / max) * 100);
        return (
          <li key={b.className}>
            <button
              type="button"
              onClick={() => toggle(b.className)}
              onMouseEnter={() => setHovered(b.className)}
              onMouseLeave={() => setHovered(null)}
              className="group flex w-full items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/5"
              title={`${classLabel(b.className)} · ${formatInt(b.count)}`}
            >
              <span className="data-num w-10 shrink-0 text-xs text-zinc-400">
                {b.className}
              </span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                    active
                      ? "bg-accent"
                      : "bg-gradient-to-r from-accent/50 to-nebula/60 group-hover:from-accent/80 group-hover:to-nebula/90",
                  )}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span
                className={cn(
                  "data-num w-16 shrink-0 text-right text-xs tabular-nums",
                  hovered === b.className || active
                    ? "text-accent"
                    : "text-zinc-400",
                )}
              >
                {formatInt(b.count)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
