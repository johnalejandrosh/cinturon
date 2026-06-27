/**
 * Pure orbital-mechanics & estimation helpers.
 *
 * Everything here is a deterministic function with no I/O and no framework
 * imports, so it can run identically on the server (aggregations) and on the
 * client (per-row risk colouring, the animated 3D belt). All inputs are plain
 * numbers; callers are responsible for handling nulls.
 *
 * These are physically-motivated *approximations* for a visual simulation, not
 * an ephemeris-grade propagator. Assumptions are documented inline.
 */

export const DEG2RAD = Math.PI / 180;

/** Mean orbital speed of Earth (km/s); used to scale the vis-viva estimate. */
export const EARTH_MEAN_SPEED_KMS = 29.7847;

/** Default bulk density (kg/m³) — between C-type (~1.3) and S-type (~2.7) g/cm³. */
export const DEFAULT_DENSITY = 2000;

/** PHA-grade closeness: MOID ≤ 0.05 AU ≈ 19.5 lunar distances. */
export const CLOSE_APPROACH_LD = 19.5;

const KM_PER_AU = 1.495978707e8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Estimate mass (kg) of a spherical body of the given diameter (km).
 * mass = ρ · (4/3)π r³, with r in metres.
 */
export function estimateMassKg(diameterKm: number, density = DEFAULT_DENSITY): number {
  const radiusM = (diameterKm * 1000) / 2;
  const volumeM3 = (4 / 3) * Math.PI * radiusM ** 3;
  return density * volumeM3;
}

/**
 * Total mass from a pre-aggregated Σ(diameter³) (km³) computed in SQL.
 * Σ mass = ρ·(4/3)π · (500)³ · Σ(d³)  because r = 500·d metres when d is in km.
 */
export function totalMassFromDiameterCubeSum(
  sumDiameterCubeKm3: number,
  density = DEFAULT_DENSITY,
): number {
  return density * (4 / 3) * Math.PI * 500 ** 3 * sumDiameterCubeKm3;
}

/**
 * Mean orbital speed (km/s) for a near-circular orbit of semi-major axis a (AU),
 * from the vis-viva relation evaluated at r = a: v = √(GM☉/a) = v⊕ / √a.
 */
export function orbitalVelocityKmS(aAu: number): number {
  if (aAu <= 0) return 0;
  return EARTH_MEAN_SPEED_KMS / Math.sqrt(aAu);
}

export type RiskLevel = "low" | "mid" | "high";

export interface RiskInput {
  pha: boolean;
  neo: boolean;
  moidLd: number | null;
  diameter: number | null;
  h: number | null;
}

/**
 * Composite impact-risk score in [0, 100]. Blends hazard classification,
 * Earth proximity (MOID) and size. Heuristic, for ranking/colouring only.
 */
export function riskScore({ pha, neo, moidLd, diameter, h }: RiskInput): number {
  // Hazard classification — the dominant term.
  const hazard = pha ? 50 : neo ? 25 : 0;

  // Proximity: closer than ~50 LD ramps up to 30 points.
  const proximity =
    moidLd != null ? clamp((50 - moidLd) / 50, 0, 1) * 30 : 0;

  // Size: prefer measured diameter, fall back to absolute magnitude H.
  let size = 0;
  if (diameter != null) {
    size = clamp(diameter / 10, 0, 1) * 20; // 10 km ⇒ full size weight
  } else if (h != null) {
    size = clamp((25 - h) / 25, 0, 1) * 20; // brighter (smaller H) ⇒ larger
  }

  return clamp(Math.round(hazard + proximity + size), 0, 100);
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 66) return "high";
  if (score >= 33) return "mid";
  return "low";
}

// ───────────────────────── Kepler propagation ─────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Solve Kepler's equation E − e·sinE = M (radians) via Newton–Raphson. */
export function solveKepler(meanAnomaly: number, e: number): number {
  let E = e < 0.8 ? meanAnomaly : Math.PI;
  for (let k = 0; k < 8; k++) {
    const dE = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

/** Wrap an angle (degrees) into [0, 360). */
export function wrapDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

interface ElementsForPropagation {
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  ma: number;
  n: number;
}

/** Mean anomaly (degrees) after `days` from epoch. */
export function meanAnomalyAt(el: ElementsForPropagation, days: number): number {
  return wrapDeg(el.ma + el.n * days);
}

/**
 * Heliocentric ecliptic position (AU) for a given mean anomaly (degrees).
 * Transforms perifocal coordinates to the ecliptic frame using Ω, i and ω.
 */
export function positionFromMeanAnomaly(
  el: ElementsForPropagation,
  meanAnomalyDeg: number,
): Vec3 {
  const e = el.e;
  const M = meanAnomalyDeg * DEG2RAD;
  const E = solveKepler(M, e);

  // Coordinates in the orbital (perifocal) plane.
  const xv = el.a * (Math.cos(E) - e);
  const yv = el.a * (Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E));

  const o = el.om * DEG2RAD;
  const w = el.w * DEG2RAD;
  const inc = el.i * DEG2RAD;

  const cosO = Math.cos(o);
  const sinO = Math.sin(o);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);

  const x =
    (cosO * cosW - sinO * sinW * cosI) * xv +
    (-cosO * sinW - sinO * cosW * cosI) * yv;
  const y =
    (sinO * cosW + cosO * sinW * cosI) * xv +
    (-sinO * sinW + cosO * cosW * cosI) * yv;
  const z = sinW * sinI * xv + cosW * sinI * yv;

  return { x, y, z };
}

/** Convenience: position (AU) `days` after the element epoch. */
export function positionAt(el: ElementsForPropagation, days: number): Vec3 {
  return positionFromMeanAnomaly(el, meanAnomalyAt(el, days));
}

export function distanceAu(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function auToKm(au: number): number {
  return au * KM_PER_AU;
}

/**
 * Approximate mean Keplerian elements (J2000-ish) for the inner reference
 * planets, used to draw their orbits and animate the bodies. Following the
 * codebase convention these reuse the longitude of perihelion as `w` and the
 * mean longitude as `ma` — accurate enough for a visual simulation.
 */
export const EARTH_ELEMENTS: ElementsForPropagation = {
  a: 1.00000011,
  e: 0.01671022,
  i: 0.00005,
  om: -11.26064,
  w: 102.94719,
  ma: 100.46435,
  n: 0.9856076686, // deg/day
};

export const MARS_ELEMENTS: ElementsForPropagation = {
  a: 1.52371034,
  e: 0.0933941,
  i: 1.84969142,
  om: 49.55953891,
  w: -23.94362959,
  ma: -4.55343205,
  n: 0.5240207766, // deg/day
};

export const JUPITER_ELEMENTS: ElementsForPropagation = {
  a: 5.202887,
  e: 0.04838624,
  i: 1.30439695,
  om: 100.47390909,
  w: 14.72847983,
  ma: 34.39644051,
  n: 0.0830853001, // deg/day
};
