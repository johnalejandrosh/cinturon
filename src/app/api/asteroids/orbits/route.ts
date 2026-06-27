import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getAsteroidRepository } from "@/features/asteroids/infrastructure";
import { getOrbitSample } from "@/features/asteroids/application/asteroid-queries";
import { clampInt, filtersFromUrl, jsonError } from "@/features/asteroids/application/http";

/**
 * GET /api/asteroids/orbits
 * A sample of orbital elements (the N largest bodies in the filter) for the 3D
 * belt map. Elements are propagated client-side to animate the timeline.
 */
export async function GET(request: NextRequest) {
  try {
    const filters = filtersFromUrl(request.nextUrl);
    const limit = clampInt(request.nextUrl.searchParams.get("limit"), 1500, 50, 1000000);

    const repo = getAsteroidRepository();
    const { items, total } = await getOrbitSample(repo, filters, limit);

    return Response.json({ orbits: items, total });
  } catch (err) {
    unstable_rethrow(err);
    console.error("[GET /api/asteroids/orbits]", err);
    return jsonError("No se pudieron cargar las órbitas.");
  }
}
