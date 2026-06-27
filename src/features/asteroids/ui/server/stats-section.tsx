import "server-only";

import type { AsteroidFilters } from "../../domain/filters";
import { KpiGrid } from "../components/kpi/kpi-grid";
import { ClassDistribution } from "../components/distribution/class-distribution";
import { cachedClassDistribution, cachedDashboardStats } from "./cached";

/**
 * Server section (streamed via Suspense) that computes the KPI metrics and the
 * class distribution from cached read models, then hands them to client
 * components for the live counters and interactive bars.
 */
export async function StatsSection({ filters }: { filters: AsteroidFilters }) {
  const [stats, distribution] = await Promise.all([
    cachedDashboardStats(filters),
    cachedClassDistribution(filters),
  ]);

  return (
    <div className="space-y-4">
      <KpiGrid stats={stats} />
      <section className="panel">
        <h2 className="label mb-3">Distribución por clase orbital</h2>
        <ClassDistribution buckets={distribution} filters={filters} />
      </section>
    </div>
  );
}
