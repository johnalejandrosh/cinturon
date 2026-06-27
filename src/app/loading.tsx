import { DashboardHeader } from "@/features/asteroids/ui/components/dashboard-header";
import {
  KpiSkeleton,
  MapSkeleton,
  TableSkeleton,
} from "@/features/asteroids/ui/components/skeletons";

/** Instant shell shown while the dashboard route streams in. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-4 px-3 py-5 sm:px-6 sm:py-7">
      <DashboardHeader />
      <div className="panel">
        <div className="skeleton h-10 w-full" />
      </div>
      <KpiSkeleton />
      <div className="grid gap-4 xl:grid-cols-2">
        <MapSkeleton />
        <TableSkeleton />
      </div>
    </main>
  );
}
