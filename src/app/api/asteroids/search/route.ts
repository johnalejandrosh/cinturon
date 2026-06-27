import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getAsteroidRepository } from "@/features/asteroids/infrastructure";
import { searchAsteroids } from "@/features/asteroids/application/asteroid-queries";
import { clampInt, jsonError } from "@/features/asteroids/application/http";

/**
 * GET /api/asteroids/search?q=...&limit=...
 * Typeahead search by name / designation for the autocomplete box.
 */
export async function GET(request: NextRequest) {
  try {
    const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (term.length < 1) {
      return Response.json({ items: [] });
    }
    const limit = clampInt(request.nextUrl.searchParams.get("limit"), 10, 1, 25);

    const repo = getAsteroidRepository();
    const items = await searchAsteroids(repo, term, limit);

    return Response.json({ items });
  } catch (err) {
    unstable_rethrow(err);
    console.error("[GET /api/asteroids/search]", err);
    return jsonError("La búsqueda no está disponible en este momento.");
  }
}
