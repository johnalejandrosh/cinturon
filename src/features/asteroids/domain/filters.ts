/**
 * The {@link AsteroidFilters} value object plus pure helpers to parse it from /
 * serialize it to URL query params, derive a stable cache key, and validate it.
 *
 * This is the contract shared by the URL (useSearchParams), the route handlers
 * and the SQL adapter — keeping it in the domain guarantees they never drift.
 */

export type RangeBounds = { readonly min: number; readonly max: number; readonly step: number };

/** Slider bounds for the numeric filters. Values outside these are clamped. */
export const BOUNDS = {
  diameter: { min: 0, max: 1000, step: 1 }, // km
  albedo: { min: 0, max: 1, step: 0.01 },
  a: { min: 0, max: 6, step: 0.05 }, // semi-major axis (AU) — NEOs → outer belt/Trojans
} satisfies Record<string, RangeBounds>;

export const SORTS = {
  id: "Identificador",
  diameter: "Diámetro",
  albedo: "Albedo",
  a: "Distancia (a)",
  e: "Excentricidad",
  i: "Inclinación",
  h: "Magnitud (H)",
  name: "Nombre",
} as const;

export type SortKey = keyof typeof SORTS;
export type SortDir = "asc" | "desc";

export const SORT_KEYS = Object.keys(SORTS) as SortKey[];

/** Tri-state boolean filter: `null` means "no preference". */
export type TriState = boolean | null;

export interface NumberRange {
  /** `null` = open (use the bound). */
  min: number | null;
  max: number | null;
}

export interface AsteroidFilters {
  diameter: NumberRange;
  albedo: NumberRange;
  /** Semi-major axis range = orbital distance to the Sun. */
  a: NumberRange;
  classes: string[];
  neo: TriState;
  pha: TriState;
  /** Free-text on name / designation. */
  q: string | null;
  sort: SortKey;
  dir: SortDir;
}

export const DEFAULT_FILTERS: AsteroidFilters = {
  diameter: { min: null, max: null },
  albedo: { min: null, max: null },
  a: { min: null, max: null },
  classes: [],
  neo: null,
  pha: null,
  q: null,
  sort: "id",
  dir: "asc",
};

// ───────────────────────────── parsing ─────────────────────────────

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseNum(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampToBounds(value: number | null, b: RangeBounds): number | null {
  if (value == null) return null;
  return Math.min(b.max, Math.max(b.min, value));
}

function parseRange(params: RawParams, key: string, b: RangeBounds): NumberRange {
  let min = clampToBounds(parseNum(one(params, `${key}_min`)), b);
  let max = clampToBounds(parseNum(one(params, `${key}_max`)), b);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  // Drop ranges that equal the full bounds (keeps URLs clean and cache keys stable).
  if (min === b.min) min = null;
  if (max === b.max) max = null;
  return { min, max };
}

function parseTri(value: string | undefined): TriState {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

function parseSort(value: string | undefined): SortKey {
  return (SORT_KEYS as string[]).includes(value ?? "") ? (value as SortKey) : "id";
}

const CLASS_PATTERN = /^[A-Z]{2,4}$/;

function parseClasses(params: RawParams): string[] {
  const raw = one(params, "cls");
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => CLASS_PATTERN.test(c)),
    ),
  ).slice(0, 16);
}

/** Build {@link AsteroidFilters} from awaited `searchParams`, validating/clamping. */
export function parseFilters(params: RawParams): AsteroidFilters {
  const q = one(params, "q")?.trim();
  return {
    diameter: parseRange(params, "dia", BOUNDS.diameter),
    albedo: parseRange(params, "alb", BOUNDS.albedo),
    a: parseRange(params, "a", BOUNDS.a),
    classes: parseClasses(params),
    neo: parseTri(one(params, "neo")),
    pha: parseTri(one(params, "pha")),
    q: q ? q.slice(0, 120) : null,
    sort: parseSort(one(params, "sort")),
    dir: one(params, "dir") === "desc" ? "desc" : "asc",
  };
}

// ───────────────────────────── serializing ─────────────────────────────

/** Serialize filters back to a `URLSearchParams` (omitting defaults). */
export function filtersToSearchParams(f: AsteroidFilters): URLSearchParams {
  const sp = new URLSearchParams();
  const setRange = (key: string, r: NumberRange) => {
    if (r.min != null) sp.set(`${key}_min`, String(r.min));
    if (r.max != null) sp.set(`${key}_max`, String(r.max));
  };
  setRange("dia", f.diameter);
  setRange("alb", f.albedo);
  setRange("a", f.a);
  if (f.classes.length) sp.set("cls", f.classes.join(","));
  if (f.neo != null) sp.set("neo", f.neo ? "1" : "0");
  if (f.pha != null) sp.set("pha", f.pha ? "1" : "0");
  if (f.q) sp.set("q", f.q);
  if (f.sort !== "id") sp.set("sort", f.sort);
  if (f.dir !== "asc") sp.set("dir", f.dir);
  return sp;
}

export function filtersToQueryString(f: AsteroidFilters): string {
  return filtersToSearchParams(f).toString();
}

/**
 * Stable key for the WHERE-clause portion of the filters (ignores sort/dir,
 * which don't change aggregate results). Used as a `cacheTag`/cache key so
 * identical filter combinations reuse the same cached stats.
 */
export function filtersWhereKey(f: AsteroidFilters): string {
  return JSON.stringify({
    d: [f.diameter.min, f.diameter.max],
    al: [f.albedo.min, f.albedo.max],
    a: [f.a.min, f.a.max],
    c: [...f.classes].sort(),
    neo: f.neo,
    pha: f.pha,
    q: f.q,
  });
}

export function hasActiveFilters(f: AsteroidFilters): boolean {
  return filtersWhereKey(f) !== filtersWhereKey(DEFAULT_FILTERS);
}
