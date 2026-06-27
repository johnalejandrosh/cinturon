import "server-only";

import type { AsteroidFilters } from "../domain/filters";
import type { AsteroidRepository } from "../domain/ports";
import {
  clamp,
  orbitalVelocityKmS,
  totalMassFromDiameterCubeSum,
} from "../domain/physics";

/** KPI view model: raw aggregates enriched with physics-derived quantities. */
export interface DashboardStats {
  total: number;
  withDiameter: number;
  avgDiameterKm: number | null;
  estimatedTotalMassKg: number | null;
  avgOrbitalVelocityKmS: number | null;
  avgAlbedo: number | null;
  avgSemiMajorAxisAu: number | null;
  neoCount: number;
  phaCount: number;
  closeApproachCount: number;
  minMoidLd: number | null;
  /** Composite impact-risk index in [0, 100] for the current selection. */
  riskIndex: number;
}

/** Aggregate the KPI metrics for the active filters. */
export async function getDashboardStats(
  repo: AsteroidRepository,
  filters: AsteroidFilters,
): Promise<DashboardStats> {
  const raw = await repo.stats(filters);

  const estimatedTotalMassKg =
    raw.sumDiameterCubeKm3 != null
      ? totalMassFromDiameterCubeSum(raw.sumDiameterCubeKm3)
      : null;

  const avgOrbitalVelocityKmS =
    raw.avgInvSqrtA != null
      ? raw.avgInvSqrtA * orbitalVelocityKmS(1) // 29.78 km/s × AVG(1/√a)
      : raw.avgSemiMajorAxisAu != null
        ? orbitalVelocityKmS(raw.avgSemiMajorAxisAu)
        : null;

  return {
    total: raw.total,
    withDiameter: raw.withDiameter,
    avgDiameterKm: raw.avgDiameterKm,
    estimatedTotalMassKg,
    avgOrbitalVelocityKmS,
    avgAlbedo: raw.avgAlbedo,
    avgSemiMajorAxisAu: raw.avgSemiMajorAxisAu,
    neoCount: raw.neoCount,
    phaCount: raw.phaCount,
    closeApproachCount: raw.closeApproachCount,
    minMoidLd: raw.minMoidLd,
    riskIndex: computeRiskIndex(raw),
  };
}

/**
 * Portfolio risk index: blends how close the nearest body comes (MOID) with how
 * dense the selection is in hazardous (PHA/NEO) objects. Heuristic, 0–100.
 */
function computeRiskIndex(raw: {
  total: number;
  neoCount: number;
  phaCount: number;
  minMoidLd: number | null;
}): number {
  const proximity =
    raw.minMoidLd != null ? clamp((20 - raw.minMoidLd) / 20, 0, 1) : 0;
  const hazardDensity =
    raw.total > 0
      ? clamp((raw.phaCount * 8 + raw.neoCount) / raw.total, 0, 1)
      : 0;
  return clamp(Math.round(proximity * 60 + hazardDensity * 40), 0, 100);
}
