import type { RiskLevel } from "../domain/physics";

/** Maps a risk level to Tailwind classes and raw hex (for canvas/SVG). */
export const RISK_TEXT: Record<RiskLevel, string> = {
  low: "text-risk-low",
  mid: "text-risk-mid",
  high: "text-risk-high",
};

export const RISK_BG: Record<RiskLevel, string> = {
  low: "bg-risk-low/15 text-risk-low border-risk-low/30",
  mid: "bg-risk-mid/15 text-risk-mid border-risk-mid/30",
  high: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

export const RISK_HEX: Record<RiskLevel, string> = {
  low: "#34d399",
  mid: "#fbbf24",
  high: "#fb7185",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Bajo",
  mid: "Medio",
  high: "Alto",
};

/** Interpolate green → amber → red for a 0–100 score (used by the risk KPI). */
export function riskGradientHex(score: number): string {
  const s = Math.max(0, Math.min(100, score)) / 100;
  // 0 → emerald (52,211,153), 0.5 → amber (251,191,36), 1 → rose (251,113,133)
  const stops = [
    [52, 211, 153],
    [251, 191, 36],
    [251, 113, 133],
  ];
  const seg = s < 0.5 ? 0 : 1;
  const t = s < 0.5 ? s / 0.5 : (s - 0.5) / 0.5;
  const [a, b] = [stops[seg], stops[seg + 1]];
  const ch = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}
