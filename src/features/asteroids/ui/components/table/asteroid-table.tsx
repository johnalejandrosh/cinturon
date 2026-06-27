"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AsteroidSummary } from "../../../domain/asteroid";
import { classLabel } from "../../../domain/asteroid";
import { riskLevel, riskScore } from "../../../domain/physics";
import { RISK_HEX } from "../../risk";
import {
  formatDiameter,
  formatInt,
  formatLd,
  formatNumber,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import { AsteroidDetailDrawer } from "../detail/asteroid-detail-drawer";

const ROW_HEIGHT = 46;
const GRID =
  "grid grid-cols-[1.7fr_70px_92px_84px_64px_64px_92px_104px] gap-2 px-4";

interface AsteroidTableProps {
  initialItems: AsteroidSummary[];
  initialCursor: string | null;
  initialHasMore: boolean;
  /** Serialized active filters; identity change ⇒ reset the list. */
  queryString: string;
  /** Total in the current selection (for the footer). */
  total: number;
}

export function AsteroidTable({
  initialItems,
  initialCursor,
  initialHasMore,
  queryString,
  total,
}: AsteroidTableProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AsteroidSummary | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // Reset when the filters (and thus the server-provided first page) change.
  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    parentRef.current?.scrollTo({ top: 0 });
  }, [queryString, initialItems, initialCursor, initialHasMore]);

  const fetchMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams(queryString);
      if (cursorRef.current) params.set("cursor", cursorRef.current);
      params.set("limit", "60");
      const res = await fetch(`/api/asteroids?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data: {
        items: AsteroidSummary[];
        nextCursor: string | null;
        hasMore: boolean;
      } = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, queryString]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Trigger the next page when the viewport nears the end of the loaded rows.
  useEffect(() => {
    const last = virtualRows[virtualRows.length - 1];
    if (last && last.index >= items.length - 10) {
      void fetchMore();
    }
  }, [virtualRows, items.length, fetchMore]);

  return (
    <div className="panel flex min-h-0 flex-col !p-0">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          Catálogo de asteroides
        </h2>
        <span className="data-num text-xs text-zinc-400">
          {formatInt(items.length)} de {formatInt(total)}
        </span>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div
            className={cn(
              GRID,
              "border-b border-white/10 py-2 text-[0.68rem] uppercase tracking-wider text-zinc-500",
            )}
          >
            <span>Designación</span>
            <span>Clase</span>
            <span className="text-right">Diámetro</span>
            <span className="text-right">a (UA)</span>
            <span className="text-right">e</span>
            <span className="text-right">i (°)</span>
            <span className="text-right">MOID</span>
            <span className="text-right">Riesgo</span>
          </div>

          <div ref={parentRef} className="h-[460px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-500">
                No se encontraron asteroides con estos filtros.
              </div>
            ) : (
              <div
                style={{ height: virtualizer.getTotalSize(), position: "relative" }}
              >
                {virtualRows.map((vr) => {
                  const a = items[vr.index];
                  return (
                    <Row
                      key={a.id}
                      asteroid={a}
                      onSelect={() => setSelected(a)}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: ROW_HEIGHT,
                        transform: `translateY(${vr.start}px)`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-zinc-500">
        <span>Desplázate para cargar más · paginación por cursor (keyset)</span>
        {loading && (
          <span className="flex items-center gap-2 text-accent">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            Cargando…
          </span>
        )}
        {!hasMore && items.length > 0 && <span>Fin del listado</span>}
      </footer>

      {selected && (
        <AsteroidDetailDrawer
          summary={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Row({
  asteroid,
  onSelect,
  style,
}: {
  asteroid: AsteroidSummary;
  onSelect: () => void;
  style: React.CSSProperties;
}) {
  const score = riskScore({
    pha: asteroid.pha,
    neo: asteroid.neo,
    moidLd: asteroid.moidLd,
    diameter: asteroid.diameter,
    h: asteroid.h,
  });
  const level = riskLevel(score);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      className={cn(
        GRID,
        "items-center border-b border-white/5 text-left text-sm transition-colors hover:bg-white/[0.05]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-zinc-100">
          {asteroid.name ?? asteroid.fullName ?? asteroid.id}
        </span>
        {asteroid.neo && (
          <span className="chip !px-1.5 !py-0 text-[0.6rem] text-accent">NEO</span>
        )}
        {asteroid.pha && (
          <span className="chip !px-1.5 !py-0 text-[0.6rem] !text-risk-high">PHA</span>
        )}
      </span>
      <span className="data-num text-xs text-zinc-400" title={classLabel(asteroid.className)}>
        {asteroid.className ?? "—"}
      </span>
      <span className="data-num text-right text-zinc-300">
        {formatDiameter(asteroid.diameter)}
      </span>
      <span className="data-num text-right text-zinc-300">
        {formatNumber(asteroid.a, 3)}
      </span>
      <span className="data-num text-right text-zinc-300">
        {formatNumber(asteroid.e, 3)}
      </span>
      <span className="data-num text-right text-zinc-300">
        {formatNumber(asteroid.i, 1)}
      </span>
      <span className="data-num text-right text-zinc-400">
        {formatLd(asteroid.moidLd)}
      </span>
      <span className="flex items-center justify-end gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: RISK_HEX[level], boxShadow: `0 0 6px ${RISK_HEX[level]}` }}
        />
        <span className="data-num text-xs text-zinc-300">{score}</span>
      </span>
    </button>
  );
}
