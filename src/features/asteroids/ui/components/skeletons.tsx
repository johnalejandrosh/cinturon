/** Streaming fallbacks shown while server sections fetch (animate-pulse). */

export function KpiSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="kpi-card">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-4 h-8 w-28" />
            <div className="skeleton mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel !p-3">
            <div className="skeleton h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="panel !p-0">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="panel !p-0">
      <div className="px-4 py-3">
        <div className="skeleton h-4 w-48" />
      </div>
      <div className="skeleton h-[360px] w-full rounded-none sm:h-[440px]" />
    </div>
  );
}
