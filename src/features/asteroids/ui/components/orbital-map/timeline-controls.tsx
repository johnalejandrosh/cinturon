"use client";

import { PlayIcon, PauseIcon, TargetIcon } from "@/shared/ui/icons";
import { cn } from "@/shared/lib/cn";
import { formatInt } from "@/shared/lib/format";

const SPEEDS = [10, 30, 90, 200];

export function TimelineControls({
  playing,
  onPlayToggle,
  speed,
  onSpeed,
  days,
  maxDays,
  onSeek,
  encounters,
}: {
  playing: boolean;
  onPlayToggle: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  days: number;
  maxDays: number;
  onSeek: (days: number) => void;
  encounters: number;
}) {
  const years = days / 365.25;
  return (
    <div className="flex flex-col gap-3 border-t border-white/10 p-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onPlayToggle}
        className="btn-accent !px-2.5"
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="flex flex-1 items-center gap-3">
        <input
          type="range"
          min={0}
          max={maxDays}
          step={1}
          value={Math.min(maxDays, Math.max(0, days))}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--color-accent)]"
          aria-label="Línea de tiempo"
        />
        <span className="data-num w-20 shrink-0 text-right text-xs text-zinc-300">
          +{years.toFixed(2)} a
        </span>
      </div>

      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            className={cn("chip", speed === s && "chip-active")}
            title={`${s} días/s`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
          encounters > 0
            ? "border-risk-high/40 bg-risk-high/10 text-risk-high"
            : "border-white/10 bg-white/5 text-zinc-400",
        )}
        title="Encuentros simulados a menos de 0,05 UA de la Tierra"
      >
        <TargetIcon width={14} height={14} />
        <span className="data-num font-semibold">{formatInt(encounters)}</span>
        <span className="hidden sm:inline">encuentros</span>
      </div>
    </div>
  );
}
