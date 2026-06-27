import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getAsteroidRepository } from "@/features/asteroids/infrastructure";
import { getAsteroidById } from "@/features/asteroids/application/asteroid-queries";
import { jsonError } from "@/features/asteroids/application/http";

/**
 * GET /api/asteroids/:id
 * Full detail for a single body (extra orbital elements + uncertainties),
 * lazily fetched when a table row is expanded.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = getAsteroidRepository();
    const detail = await getAsteroidById(repo, id);

    if (!detail) return jsonError("Asteroide no encontrado.", 404);
    return Response.json(detail);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[GET /api/asteroids/:id]", err);
    return jsonError("No se pudo cargar el detalle del asteroide.");
  }
}
