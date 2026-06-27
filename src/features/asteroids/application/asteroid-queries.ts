import "server-only";

import type { AsteroidFilters } from "../domain/filters";
import type {
  AsteroidRepository,
  ClassBucket,
  Cursor,
  OrbitSample,
  Page,
} from "../domain/ports";
import type { AsteroidDetail, AsteroidSummary } from "../domain/asteroid";

export const DEFAULT_PAGE_SIZE = 60;
export const DEFAULT_ORBIT_SAMPLE = 1500;

/** Keyset-paginated list use case. */
export function listAsteroids(
  repo: AsteroidRepository,
  filters: AsteroidFilters,
  cursor: Cursor,
  limit = DEFAULT_PAGE_SIZE,
): Promise<Page<AsteroidSummary>> {
  return repo.list({ filters, cursor, limit });
}

/** Typeahead search use case. */
export function searchAsteroids(
  repo: AsteroidRepository,
  term: string,
  limit = 10,
): Promise<AsteroidSummary[]> {
  return repo.search(term, limit);
}

/** Orbital-elements sample for the 3D belt (plus the total it was drawn from). */
export function getOrbitSample(
  repo: AsteroidRepository,
  filters: AsteroidFilters,
  limit = DEFAULT_ORBIT_SAMPLE,
): Promise<OrbitSample> {
  return repo.orbitSample(filters, limit);
}

/** Per-class counts for the distribution chart. */
export function getClassDistribution(
  repo: AsteroidRepository,
  filters: AsteroidFilters,
): Promise<ClassBucket[]> {
  return repo.classDistribution(filters);
}

/** Full detail for one body. */
export function getAsteroidById(
  repo: AsteroidRepository,
  id: string,
): Promise<AsteroidDetail | null> {
  return repo.getById(id);
}
