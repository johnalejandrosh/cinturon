"use client";

import { BOUNDS, DEFAULT_FILTERS, type AsteroidFilters } from "../../domain/filters";
import { KNOWN_CLASS_CODES } from "../../domain/asteroid";
import { clamp } from "../../domain/physics";
import { DiceIcon } from "@/shared/ui/icons";
import { useFilterNavigation } from "../hooks/use-filter-navigation";

function randomFilters(): AsteroidFilters {
  const aCenter = 0.8 + Math.random() * 4;
  const aHalf = 0.3 + Math.random() * 1;
  const dMax = Math.round(20 + Math.random() * 300);
  const dMin = Math.round(Math.random() * Math.min(20, dMax));

  const pickClass = Math.random() < 0.5;
  const classes = pickClass
    ? [KNOWN_CLASS_CODES[Math.floor(Math.random() * KNOWN_CLASS_CODES.length)]]
    : [];

  return {
    ...DEFAULT_FILTERS,
    a: {
      min: clamp(aCenter - aHalf, BOUNDS.a.min, BOUNDS.a.max),
      max: clamp(aCenter + aHalf, BOUNDS.a.min, BOUNDS.a.max),
    },
    diameter: {
      min: dMin <= 0 ? null : dMin,
      max: dMax,
    },
    classes,
    neo: Math.random() < 0.15 ? true : null,
  };
}

/**
 * Floating "random mode" button. Each press jumps to a new slice of the belt —
 * a different density and size regime — to encourage exploration.
 */
export function RandomButton() {
  const { commit } = useFilterNavigation();
  return (
    <button
      type="button"
      onClick={() => commit(randomFilters())}
      className="btn-accent animate-pulse-glow fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full !p-0 shadow-lg"
      title="Modo aleatorio — explorar el cinturón"
      aria-label="Explorar una configuración aleatoria del cinturón"
    >
      <DiceIcon width={24} height={24} />
    </button>
  );
}
