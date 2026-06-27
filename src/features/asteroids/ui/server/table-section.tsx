import "server-only";

import type { AsteroidFilters } from "../../domain/filters";
import { AsteroidTable } from "../components/table/asteroid-table";
import { cachedDashboardStats, cachedInitialList } from "./cached";

/**
 * Server section (streamed via Suspense) that loads the first keyset page and
 * the total count, then renders the virtualized, infinite-scrolling table.
 * `cachedDashboardStats` is shared with the KPI section, so the total is a cache
 * hit on identical filters.
 */
export async function TableSection({
  filters,
  queryString,
}: {
  filters: AsteroidFilters;
  queryString: string;
}) {
  const [page, stats] = await Promise.all([
    cachedInitialList(filters),
    cachedDashboardStats(filters),
  ]);

  return (
    <AsteroidTable
      initialItems={page.items}
      initialCursor={page.nextCursor}
      initialHasMore={page.hasMore}
      queryString={queryString}
      total={stats.total}
    />
  );
}
