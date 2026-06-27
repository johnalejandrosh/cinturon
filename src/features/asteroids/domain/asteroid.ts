/**
 * Domain entities for the asteroid feature.
 *
 * These types are framework-agnostic and contain no SQL, no React and no
 * Next.js imports — they are the language the rest of the hexagon speaks.
 *
 * The dataset has ~45 columns; we deliberately model lean projections so that
 * "general" views (table rows, orbital points) stay far below the 15 KB payload
 * budget. Heavy/diagnostic columns (sigmas, calendar epochs, rms, …) are only
 * surfaced in {@link AsteroidDetail}.
 */

/** Orbital class codes used by JPL/SBDB, with Spanish labels for the UI. */
export const KNOWN_CLASSES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "IEO", label: "Atira (interior a la Tierra)" },
  { code: "ATE", label: "Atón" },
  { code: "APO", label: "Apolo" },
  { code: "AMO", label: "Amor" },
  { code: "MCA", label: "Cruza Marte" },
  { code: "IMB", label: "Cinturón interior" },
  { code: "MBA", label: "Cinturón principal" },
  { code: "OMB", label: "Cinturón exterior" },
  { code: "TJN", label: "Troyano de Júpiter" },
  { code: "CEN", label: "Centauro" },
  { code: "TNO", label: "Transneptuniano" },
  { code: "AST", label: "Asteroide (genérico)" },
];

export const KNOWN_CLASS_CODES: readonly string[] = KNOWN_CLASSES.map((c) => c.code);

export function classLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return KNOWN_CLASSES.find((c) => c.code === code)?.label ?? code;
}

/**
 * Light projection used in the virtualized table and any list view.
 * Keep this small — it is serialized once per row.
 */
export interface AsteroidSummary {
  id: string;
  fullName: string | null;
  name: string | null;
  /** SBDB orbital `class` column (renamed: `class` is a reserved word). */
  className: string | null;
  neo: boolean;
  pha: boolean;
  /** Absolute magnitude H (lower ⇒ larger/brighter). */
  h: number | null;
  /** Diameter in km. */
  diameter: number | null;
  albedo: number | null;
  /** Semi-major axis in AU (orbital distance). */
  a: number | null;
  /** Eccentricity. */
  e: number | null;
  /** Inclination in degrees. */
  i: number | null;
  /** Perihelion distance in AU. */
  q: number | null;
  /** Aphelion distance in AU. */
  ad: number | null;
  /** Orbital period in years. */
  perY: number | null;
  /** Minimum Orbit Intersection Distance in lunar distances. */
  moidLd: number | null;
}

/**
 * Keplerian elements needed to plot a body in the 3D belt and animate it.
 * All angles in degrees; `n` (mean motion) in degrees/day.
 */
export interface OrbitalElements {
  id: string;
  name: string | null;
  className: string | null;
  pha: boolean;
  diameter: number | null;
  a: number;
  e: number;
  i: number;
  /** Longitude of the ascending node Ω (deg). */
  om: number;
  /** Argument of perihelion ω (deg). */
  w: number;
  /** Mean anomaly at epoch M (deg). */
  ma: number;
  /** Mean motion n (deg/day). */
  n: number;
}

/** Full detail shown when a row/point is expanded. */
export interface AsteroidDetail extends AsteroidSummary {
  spkid: number | null;
  pdes: string | null;
  prefix: string | null;
  om: number | null;
  w: number | null;
  ma: number | null;
  n: number | null;
  /** Period in days. */
  per: number | null;
  /** MOID in AU. */
  moid: number | null;
  orbitId: string | null;
  epochCal: string | null;
  tpCal: string | null;
  rms: number | null;
}
