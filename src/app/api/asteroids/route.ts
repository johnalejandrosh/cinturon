import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getAsteroidRepository } from "@/features/asteroids/infrastructure";
import { listAsteroids } from "@/features/asteroids/application/asteroid-queries";
import { clampInt, filtersFromUrl, jsonError } from "@/features/asteroids/application/http";

/**
 * GET /api/asteroids
 * Keyset-paginated list of asteroid summaries for the active filters.
 *
 * Query: filter params (see `domain/filters`) + `cursor` (opaque) + `limit`.
 * Reads request-time query params, so it runs dynamically at request time.
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const filters = filtersFromUrl(url);
    const cursor = url.searchParams.get("cursor");
    const limit = clampInt(url.searchParams.get("limit"), 60, 1, 200);

    const repo = getAsteroidRepository();
    const page = await listAsteroids(repo, filters, cursor, limit);

    return Response.json(page);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[GET /api/asteroids]", err);
    return jsonError("No se pudo consultar el listado de asteroides.");
  }
}
