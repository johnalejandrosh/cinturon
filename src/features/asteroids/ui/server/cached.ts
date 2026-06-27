import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { AsteroidFilters } from "../../domain/filters";
import type { ClassBucket, Page } from "../../domain/ports";
import type { AsteroidSummary } from "../../domain/asteroid";
import { getAsteroidRepository } from "../../infrastructure";
import {
  getDashboardStats,
  type DashboardStats,
} from "../../application/dashboard-stats";
import {
  DEFAULT_PAGE_SIZE,
  getClassDistribution,
  listAsteroids,
} from "../../application/asteroid-queries";

/**
 * Cached read models keyed by the (serializable) filters argument.
 *
 * The catalogue is effectively static, so caching each filter combination for a
 * few hours turns repeated/shared filter selections into instant responses and
 * shields the database from redundant aggregate scans. `cacheTag("asteroids")`
 * lets the whole feature be invalidated at once if the data is ever reloaded.
 */

export async function cachedDashboardStats(
  filters: AsteroidFilters,
): Promise<DashboardStats> {
  "use cache";
  cacheLife("hours");
  cacheTag("asteroids");
  return getDashboardStats(getAsteroidRepository(), filters);
}

export async function cachedClassDistribution(
  filters: AsteroidFilters,
): Promise<ClassBucket[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("asteroids");
  return getClassDistribution(getAsteroidRepository(), filters);
}

export async function cachedInitialList(
  filters: AsteroidFilters,
): Promise<Page<AsteroidSummary>> {
  "use cache";
  cacheLife("hours");
  cacheTag("asteroids");
  return listAsteroids(getAsteroidRepository(), filters, null, DEFAULT_PAGE_SIZE);
}
