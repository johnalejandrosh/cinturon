"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AsteroidSummary, OrbitalElements } from "../../../domain/asteroid";
import { classLabel } from "../../../domain/asteroid";
import { cn } from "@/shared/lib/cn";
import { formatAu, formatDiameter, formatInt, formatNumber } from "@/shared/lib/format";
import {
  AlertIcon,
  CloseIcon,
  ExpandIcon,
  MinimizeIcon,
  OrbitIcon,
  PauseIcon,
  PlayIcon,
  TargetIcon,
} from "@/shared/ui/icons";
import { AsteroidDetailDrawer } from "../detail/asteroid-detail-drawer";
import type { HoverInfo } from "./orbital-canvas";
import { TimelineControls } from "./timeline-controls";

// The WebGL scene is heavy and touches `window`, so load it on demand, client-only.
const OrbitalCanvas = dynamic(
  () => import("./orbital-canvas").then((m) => m.OrbitalCanvas),
  {
    ssr: false,
    loading: () => <div className="skeleton h-full w-full rounded-none" />,
  },
);

const MAX_DAYS = 3650; // ±10 years of propagation

/** Quick presets for how many bodies to draw (largest first). */
const SAMPLE_SIZES = [500, 1500, 3000, 5000] as const;
/** Bounds for the custom amount; the API enforces the same range. */
const MIN_SAMPLE = 50;
const MAX_SAMPLE = 1000000;

/** Cross-browser fullscreen helpers (standard + WebKit fallback). */
type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
const fullscreenElement = () => {
  const d = document as FullscreenDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
};

/** A selected body in the map carries only orbital fields; the drawer fetches
 * the rest by id, so the unknown summary columns start as null. */
function summaryFromOrbit(el: OrbitalElements): AsteroidSummary {
  return {
    id: el.id,
    fullName: null,
    name: el.name,
    className: el.className,
    neo: false,
    pha: el.pha,
    h: null,
    diameter: el.diameter,
    albedo: null,
    a: el.a,
    e: el.e,
    i: el.i,
    q: null,
    ad: null,
    perY: null,
    moidLd: null,
  };
}

export function OrbitalMap({ queryString }: { queryString: string }) {
  const [orbits, setOrbits] = useState<OrbitalElements[] | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [limit, setLimit] = useState(1500);
  const [limitDraft, setLimitDraft] = useState("1500");
  const [loading, setLoading] = useState(true);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(30);
  const [seek, setSeek] = useState<{ days: number } | null>(null);
  const [days, setDays] = useState(0);
  const [encounters, setEncounters] = useState(0);

  const [selected, setSelected] = useState<OrbitalElements | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAllOrbits, setShowAllOrbits] = useState(false);
  const [phaOnly, setPhaOnly] = useState(false);
  const [autoTour, setAutoTour] = useState(false);
  const [flyNonce, setFlyNonce] = useState(0);

  const shown = orbits?.length ?? 0;
  const phaShown = orbits?.reduce((acc, o) => acc + (o.pha ? 1 : 0), 0) ?? 0;
  const moreAvailable = totalAvailable > shown;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mirror the browser's fullscreen state (Esc, F11, etc. all sync the icon).
  useEffect(() => {
    const sync = () => setIsFullscreen(fullscreenElement() === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current as FullscreenEl | null;
    if (!el) return;
    if (fullscreenElement()) {
      const d = document as FullscreenDoc;
      (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d);
    } else {
      (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    }
  }, []);

  // Fetch the orbital sample whenever the filters change.
  useEffect(() => {
    const ctrl = new AbortController();
    const load = () => {
      setLoading(true);
      const params = new URLSearchParams(queryString);
      params.set("limit", String(limit));
      // Quick map-local toggle: restrict the sample to hazardous bodies (PHA).
      if (phaOnly) params.set("pha", "1");
      fetch(`/api/asteroids/orbits?${params.toString()}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { orbits: [] }))
        .then((d: { orbits?: OrbitalElements[]; total?: number }) => {
          // Be defensive: a malformed/cached response must never crash render.
          const next = Array.isArray(d?.orbits) ? d.orbits : [];
          setOrbits(next);
          setTotalAvailable(typeof d?.total === "number" ? d.total : next.length);
          // Drop the selection if the new sample no longer contains that body.
          setSelected((cur) =>
            cur && next.some((o) => o.id === cur.id) ? cur : null,
          );
        })
        .catch(() => setOrbits([]))
        .finally(() => setLoading(false));
    };
    load();
    return () => ctrl.abort();
  }, [queryString, limit, phaOnly]);

  const onReport = useCallback((d: number, enc: number) => {
    setDays(d);
    setEncounters(enc);
  }, []);

  // Selecting a body closes any open detail drawer, so opening it stays explicit.
  const onSelect = useCallback((el: OrbitalElements | null) => {
    setSelected(el);
    setShowDetail(false);
  }, []);

  // Pick a preset amount (keeps the custom input in sync).
  const chooseLimit = useCallback((n: number) => {
    setLimit(n);
    setLimitDraft(String(n));
  }, []);

  // Commit the typed custom amount, clamped to the allowed range.
  const commitDraft = useCallback(() => {
    const n = Math.round(Number(limitDraft));
    if (!Number.isFinite(n) || n <= 0) {
      setLimitDraft(String(limit));
      return;
    }
    const clamped = Math.min(MAX_SAMPLE, Math.max(MIN_SAMPLE, n));
    setLimit(clamped);
    setLimitDraft(String(clamped));
  }, [limitDraft, limit]);

  // Hover updates the tooltip imperatively to avoid a re-render per mouse move.
  const onHover = useCallback((info: HoverInfo | null) => {
    const el = tooltipRef.current;
    if (!el) return;
    if (!info) {
      el.style.opacity = "0";
      return;
    }
    el.textContent = info.el.name ?? info.el.id;
    el.style.opacity = "1";
    el.style.transform = `translate(${info.x}px, ${info.y}px) translate(-50%, -150%)`;
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        "orbital-root panel flex flex-col !p-0",
        isFullscreen && "h-screen w-screen rounded-none",
      )}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            Mapa orbital 3D del cinturón
          </h2>
          <p className="text-xs text-zinc-500">
            Arrastra para rotar · rueda para zoom · clic en un punto para ver su órbita
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPhaOnly((v) => !v)}
            aria-pressed={phaOnly}
            className={cn(
              "btn !py-2",
              phaOnly && "!border-risk-high/50 !bg-risk-high/15 !text-risk-high",
            )}
            title="Muestra únicamente los asteroides potencialmente peligrosos (PHA)"
          >
            <AlertIcon width={16} height={16} />
            <span className="hidden sm:inline">
              {phaOnly ? "Mostrar todos" : "Solo peligrosos"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowAllOrbits((v) => !v)}
            aria-pressed={showAllOrbits}
            className={cn("btn !py-2", showAllOrbits && "!border-accent/50 !bg-accent/15 !text-accent")}
            title="Dibuja la órbita completa de cada asteroide de la muestra"
          >
            <OrbitIcon width={16} height={16} />
            <span className="hidden sm:inline">
              {showAllOrbits ? "Ocultar órbitas" : "Ver todas las órbitas"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !autoTour;
              setAutoTour(next);
              if (next) setPlaying(true); // keep the belt moving during the tour
            }}
            aria-pressed={autoTour}
            className={cn("btn !py-2", autoTour && "!border-accent/50 !bg-accent/15 !text-accent")}
            title="Recorrido automático: la cámara viaja sola entre asteroides al azar (modo exposición)"
          >
            {autoTour ? (
              <PauseIcon width={16} height={16} />
            ) : (
              <PlayIcon width={16} height={16} />
            )}
            <span className="hidden sm:inline">
              {autoTour ? "Detener recorrido" : "Recorrido"}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn !px-2 !py-2"
            aria-label={
              isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
            }
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <MinimizeIcon width={16} height={16} />
            ) : (
              <ExpandIcon width={16} height={16} />
            )}
          </button>
        </div>
      </header>

      <div
        className={cn(
          "relative w-full",
          isFullscreen ? "flex-1" : "h-[420px] sm:h-[540px] lg:h-[620px]",
        )}
      >
        {orbits && orbits.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Sin cuerpos con elementos orbitales para estos filtros.
          </div>
        ) : (
          orbits && (
            <OrbitalCanvas
              orbits={orbits}
              playing={playing}
              speedDaysPerSec={speed}
              seek={seek}
              selectedId={selected?.id ?? null}
              showAllOrbits={showAllOrbits}
              flyNonce={flyNonce}
              autoTour={autoTour}
              onReport={onReport}
              onSelect={onSelect}
              onHover={onHover}
            />
          )
        )}
        {loading && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          </div>
        )}

        {/* Count card: how many bodies are rendered now + a size selector. */}
        {orbits !== null && shown > 0 && (
          <div className="absolute left-3 top-3 z-10 w-44 rounded-xl border border-white/10 bg-space-900/80 px-3 py-2 shadow-lg backdrop-blur">
            <div className="flex items-end gap-2">
              <div className="data-num text-xl font-semibold leading-none text-zinc-100">
                {formatInt(shown)}
              </div>
              {loading && (
                <span className="mb-0.5 h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              )}
            </div>
            <div className="mt-1 text-[0.65rem] uppercase tracking-wider text-zinc-400">
              {moreAvailable
                ? `mostrados de ${formatInt(totalAvailable)}`
                : "asteroides en pantalla"}
            </div>

            <div className="mt-2 border-t border-white/10 pt-2">
              <div
                className="mb-1 text-[0.6rem] uppercase tracking-wider text-zinc-500"
                title="Dibuja los N asteroides más grandes de la selección"
              >
                Cantidad a mostrar
              </div>
              <div className="flex flex-wrap gap-1">
                {SAMPLE_SIZES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => chooseLimit(n)}
                    className={cn(
                      "chip !px-2 !py-0.5 !text-[0.65rem]",
                      limit === n && "chip-active",
                    )}
                  >
                    {formatInt(n)}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitDraft();
                }}
                className="mt-1.5 flex items-center gap-1"
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_SAMPLE}
                  max={MAX_SAMPLE}
                  value={limitDraft}
                  onChange={(e) => setLimitDraft(e.target.value)}
                  onBlur={commitDraft}
                  aria-label="Cantidad personalizada de asteroides"
                  className="data-num w-16 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.7rem] text-zinc-100 outline-none focus:border-accent/50"
                />
                <button type="submit" className="chip !px-2 !py-0.5 !text-[0.65rem]">
                  Ver
                </button>
              </form>
              <div className="mt-0.5 text-[0.55rem] text-zinc-500">
                personalizado: {formatInt(MIN_SAMPLE)}–{formatInt(MAX_SAMPLE)}
              </div>
            </div>

            {phaShown > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-risk-high">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "#fb7185", boxShadow: "0 0 6px #fb7185" }}
                />
                <span className="data-num font-semibold">{formatInt(phaShown)}</span>
                potencialmente peligrosos
              </div>
            )}
          </div>
        )}

        {/* Floating hover tooltip (positioned imperatively by `onHover`). */}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 max-w-[14rem] truncate rounded-md border border-white/15 bg-space-900/90 px-2 py-1 text-xs font-medium text-zinc-100 opacity-0 shadow-lg backdrop-blur transition-opacity"
          style={{ opacity: 0 }}
        />

        {/* Selected-body info card. */}
        {selected && (
          <div className="absolute right-3 top-3 z-10 w-56 rounded-xl border border-white/10 bg-space-900/90 p-3 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-zinc-100">
                  {selected.name ?? selected.id}
                </h3>
                <p className="truncate text-xs text-zinc-500">
                  {classLabel(selected.className)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setShowDetail(false);
                }}
                className="btn shrink-0 !px-1.5 !py-1.5"
                aria-label="Quitar selección"
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>

            {selected.pha && (
              <span className="chip mt-2 !text-risk-high">Potencialmente peligroso</span>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              <Stat label="Semieje (a)" value={formatAu(selected.a)} />
              <Stat label="Excentr. (e)" value={formatNumber(selected.e, 3)} />
              <Stat label="Inclin. (i)" value={`${formatNumber(selected.i, 1)}°`} />
              <Stat label="Diámetro" value={formatDiameter(selected.diameter)} />
            </dl>

            <button
              type="button"
              onClick={() => setFlyNonce((n) => n + 1)}
              className="btn-accent mt-3 flex w-full items-center justify-center gap-1.5 !py-1.5 text-xs"
            >
              <TargetIcon width={14} height={14} />
              Viajar al asteroide
            </button>
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="btn mt-2 w-full !py-1.5 text-xs"
            >
              Ver ficha completa
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[0.65rem] text-zinc-300">
          <Legend color="#ffd27a" label="Sol" />
          <Legend color="#4f9bff" label="Tierra" />
          <Legend color="#fb923c" label="Marte" />
          <Legend color="#8c9ed1" label="Cinturón" />
          <Legend color="#a855f7" label="Júpiter" />
          <Legend color="#38bdf8" label="NEO / otros" />
          <Legend color="#fb7185" label="PHA" />
        </div>
      </div>

      <TimelineControls
        playing={playing}
        onPlayToggle={() => setPlaying((p) => !p)}
        speed={speed}
        onSpeed={setSpeed}
        days={days}
        maxDays={MAX_DAYS}
        onSeek={(d) => {
          setPlaying(false);
          setDays(d);
          setSeek({ days: d });
        }}
        encounters={encounters}
      />

      {showDetail && selected && (
        <AsteroidDetailDrawer
          summary={summaryFromOrbit(selected)}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.65rem] text-zinc-500">{label}</dt>
      <dd className="data-num truncate text-xs text-zinc-200">{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 backdrop-blur",
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </span>
  );
}
