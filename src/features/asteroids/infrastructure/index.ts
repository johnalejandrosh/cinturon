import "server-only";

import type { AsteroidRepository } from "../domain/ports";
import { PostgresAsteroidRepository } from "./postgres-asteroid-repository";

/**
 * Composition root: the single place that binds the {@link AsteroidRepository}
 * port to a concrete adapter. Route handlers and server components depend on
 * this factory, never on the Postgres class directly — so the data source can
 * be swapped without touching the application or UI layers.
 */
let repository: AsteroidRepository | null = null;

export function getAsteroidRepository(): AsteroidRepository {
  if (!repository) {
    repository = new PostgresAsteroidRepository();
  }
  return repository;
}
