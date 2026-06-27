"use client";

import { useId } from "react";
import type { NumberRange, RangeBounds } from "../../../domain/filters";
import { InfoIcon } from "@/shared/ui/icons";

interface RangeSliderProps {
  label: string;
  bounds: RangeBounds;
  value: NumberRange;
  onChange: (next: NumberRange) => void;
  /** Formats a numeric value for the readout. */
  format?: (n: number) => string;
  /** Plain-language explanation shown via an info tooltip next to the label. */
  hint?: string;
}

/**
 * Dual-thumb range slider backed by two native range inputs. Emits `null` for an
 * endpoint that sits at its bound (i.e. "open"), keeping URLs and cache keys clean.
 */
export function RangeSlider({
  label,
  bounds,
  value,
  onChange,
  format = (n) => String(n),
  hint,
}: RangeSliderProps) {
  const id = useId();
  const lo = value.min ?? bounds.min;
  const hi = value.max ?? bounds.max;

  const span = bounds.max - bounds.min || 1;
  const leftPct = ((lo - bounds.min) / span) * 100;
  const widthPct = ((hi - lo) / span) * 100;

  const emit = (nextLo: number, nextHi: number) => {
    onChange({
      min: nextLo <= bounds.min ? null : nextLo,
      max: nextHi >= bounds.max ? null : nextHi,
    });
  };

  const onLow = (raw: number) => {
    const next = Math.min(raw, hi - bounds.step);
    emit(Math.max(bounds.min, next), hi);
  };
  const onHigh = (raw: number) => {
    const next = Math.max(raw, lo + bounds.step);
    emit(lo, Math.min(bounds.max, next));
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-center">
          <label htmlFor={id} className="label">
            {label}
          </label>
          {hint && (
            <span
              tabIndex={0}
              title={hint}
              aria-label={hint}
              className="ml-1 inline-flex cursor-help align-middle text-zinc-500 transition-colors hover:text-accent"
            >
              <InfoIcon width={13} height={13} />
            </span>
          )}
        </span>
        <span className="data-num text-xs text-accent">
          {format(lo)} – {format(hi)}
        </span>
      </div>
      <div className="range-dual">
        <div className="track">
          <div className="fill" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
        </div>
        <input
          id={id}
          type="range"
          aria-label={`${label} mínimo`}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          value={lo}
          onChange={(e) => onLow(Number(e.target.value))}
        />
        <input
          type="range"
          aria-label={`${label} máximo`}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          value={hi}
          onChange={(e) => onHigh(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
