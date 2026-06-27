/**
 * Driven ports for the asteroid feature (hexagonal architecture).
 *
 * The application layer depends only on {@link AsteroidRepository}; the Postgres
 * adapter in `infrastructure/` implements it. Swapping the data source (a mock,
 * a different DB, an HTTP API) means writing a new adapter — nothing else moves.
 */

import type {
  AsteroidDetail,
  AsteroidSummary,
  OrbitalElements,
} from "./asteroid";
import type { AsteroidFilters } from "./filters";

/** Opaque keyset cursor (base64). `null` = first page. */
export type Cursor = string | null;

export interface ListQuery {
  filters: AsteroidFilters;
  cursor: Cursor;
  limit: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: Cursor;
  /** True when another page is likely available. */
  hasMore: boolean;
}

/**
 * Raw aggregates straight from SQL. Derived quantities (total mass, mean
 * velocity) are computed in the application layer using `domain/physics`, so the
 * adapter stays a thin SQL translator.
 */
export interface AsteroidStatsRaw {
  total: number;
  withDiameter: number;
  avgDiameterKm: number | null;
  /** Σ(diameter³) over rows with a diameter (km³) — feeds the mass estimate. */
  sumDiameterCubeKm3: number | null;
  avgAlbedo: number | null;
  avgSemiMajorAxisAu: number | null;
  /** AVG(1/√a) — feeds the mean orbital-velocity estimate. */
  avgInvSqrtA: number | null;
  neoCount: number;
  phaCount: number;
  /** Bodies whose MOID is within {@link CLOSE_APPROACH_LD} lunar distances. */
  closeApproachCount: number;
  minMoidLd: number | null;
}

export interface ClassBucket {
  className: string;
  count: number;
}

/** The 3D belt sample plus the total number of plottable bodies it was drawn from. */
export interface OrbitSample {
  items: OrbitalElements[];
  /** Count of bodies with complete orbital elements matching the filters. */
  total: number;
}

export interface AsteroidRepository {
  /** Keyset-paginated list of light summaries for the current filters. */
  list(query: ListQuery): Promise<Page<AsteroidSummary>>;

  /** Aggregate metrics for the current filters (drives the KPI cards). */
  stats(filters: AsteroidFilters): Promise<AsteroidStatsRaw>;

  /** Count per orbital class for the current filters (distribution chart). */
  classDistribution(filters: AsteroidFilters): Promise<ClassBucket[]>;

  /** A representative sample of orbital elements for the 3D belt map. */
  orbitSample(filters: AsteroidFilters, limit: number): Promise<OrbitSample>;

  /** Typeahead search by name / designation. */
  search(term: string, limit: number): Promise<AsteroidSummary[]>;

  /** Full detail for one body, or `null` if not found. */
  getById(id: string): Promise<AsteroidDetail | null>;
}
