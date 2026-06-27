/** Locale-aware, null-safe formatters for the numeric (monospace) data. */

const DASH = "—";

const intFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("es-ES", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return intFmt.format(value);
}

/** Compact count, e.g. 1 234 567 → "1,2 M". */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return compactFmt.format(value);
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Diameter: metres below 1 km, otherwise km. */
export function formatDiameter(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return DASH;
  if (km < 1) return `${formatNumber(km * 1000, 0)} m`;
  return `${formatNumber(km, km < 10 ? 2 : 1)} km`;
}

export function formatAu(au: number | null | undefined, digits = 3): string {
  if (au == null || !Number.isFinite(au)) return DASH;
  return `${formatNumber(au, digits)} UA`;
}

export function formatKmS(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return `${formatNumber(value, 2)} km/s`;
}

export function formatDeg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return `${formatNumber(value, 2)}°`;
}

export function formatYears(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return `${formatNumber(value, 2)} a`;
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
}

/** Mass in kg, in scientific notation, e.g. "8,67 × 10²⁰ kg". */
export function formatMassKg(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return DASH;
  const exp = Math.floor(Math.log10(kg));
  const mantissa = kg / 10 ** exp;
  return `${formatNumber(mantissa, 2)} × 10${toSuperscript(exp)} kg`;
}

export function formatPercent(
  fraction: number | null | undefined,
  digits = 1,
): string {
  if (fraction == null || !Number.isFinite(fraction)) return DASH;
  return `${formatNumber(fraction * 100, digits)} %`;
}

/** Lunar distances, with a hint when it is an Earth-crossing-grade closeness. */
export function formatLd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return `${formatNumber(value, value < 100 ? 2 : 0)} DL`;
}
