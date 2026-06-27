import "server-only";

import { parseFilters, type AsteroidFilters } from "../domain/filters";

/**
 * Shared helpers to translate an incoming request URL into application inputs.
 * Kept in the application layer so both route handlers and server components
 * parse query state the same way.
 */

export function searchParamsToRecord(
  sp: URLSearchParams,
): Record<string, string> {
  return Object.fromEntries(sp.entries());
}

export function filtersFromUrl(url: URL): AsteroidFilters {
  return parseFilters(searchParamsToRecord(url.searchParams));
}

export function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = value != null ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Consistent JSON error envelope that never leaks internals to the client. */
export function jsonError(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}
