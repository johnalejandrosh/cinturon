import { Suspense } from "react";
import {
  filtersToQueryString,
  parseFilters,
} from "@/features/asteroids/domain/filters";
import { DashboardHeader } from "@/features/asteroids/ui/components/dashboard-header";
import { FiltersBar } from "@/features/asteroids/ui/components/filters/filters-bar";
import { OrbitalMap } from "@/features/asteroids/ui/components/orbital-map/orbital-map";
import { RandomButton } from "@/features/asteroids/ui/components/random-button";
import {
  KpiSkeleton,
  TableSkeleton,
} from "@/features/asteroids/ui/components/skeletons";
import { StatsSection } from "@/features/asteroids/ui/server/stats-section";
import { TableSection } from "@/features/asteroids/ui/server/table-section";

/**
 * Dashboard route. Reading `searchParams` makes this dynamic; `loading.tsx`
 * provides the instant shell while the data sections stream in via their own
 * Suspense boundaries. Filters live entirely in the URL, so every view is
 * shareable. (Next.js 16 — async searchParams, Cache Components.)
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const queryString = filtersToQueryString(filters);

  return (
    <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-4 px-3 py-5 sm:px-6 sm:py-7">
      <DashboardHeader />

      <FiltersBar filters={filters} />

      {/* Centerpiece: the 3D orbital map leads the dashboard, full-width. */}
      <OrbitalMap queryString={queryString} />

      <Suspense fallback={<KpiSkeleton />}>
        <StatsSection filters={filters} />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <TableSection filters={filters} queryString={queryString} />
      </Suspense>

      <RandomButton />
    </main>
  );
}
