"use client";

import { useEffect, useState } from "react";
import type { AsteroidDetail, AsteroidSummary } from "../../../domain/asteroid";
import { classLabel } from "../../../domain/asteroid";
import {
  estimateMassKg,
  orbitalVelocityKmS,
  riskLevel,
  riskScore,
} from "../../../domain/physics";
import { RISK_BG, RISK_LABEL } from "../../risk";
import {
  formatAu,
  formatDeg,
  formatDiameter,
  formatKmS,
  formatLd,
  formatMassKg,
  formatNumber,
  formatYears,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import { CloseIcon } from "@/shared/ui/icons";

/**
 * Slide-over panel with the key data for one body. Summary-derived metrics
 * (risk, estimated mass, mean velocity) render instantly; the richer orbital
 * elements stream in from `/api/asteroids/:id` without reloading the view.
 */
export function AsteroidDetailDrawer({
  summary,
  onClose,
}: {
  summary: AsteroidSummary;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AsteroidDetail | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/asteroids/${encodeURIComponent(summary.id)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AsteroidDetail | null) => setDetail(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [summary.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prefer the richer fetched detail; fall back to the summary so the drawer
  // works whether opened from the table (full summary) or the 3D map (partial).
  const neo = summary.neo || (detail?.neo ?? false);
  const pha = summary.pha || (detail?.pha ?? false);
  const className = summary.className ?? detail?.className ?? null;
  const diameter = summary.diameter ?? detail?.diameter ?? null;
  const albedo = summary.albedo ?? detail?.albedo ?? null;
  const h = summary.h ?? detail?.h ?? null;
  const a = summary.a ?? detail?.a ?? null;
  const e = summary.e ?? detail?.e ?? null;
  const i = summary.i ?? detail?.i ?? null;
  const q = summary.q ?? detail?.q ?? null;
  const ad = summary.ad ?? detail?.ad ?? null;
  const perY = summary.perY ?? detail?.perY ?? null;
  const moidLd = summary.moidLd ?? detail?.moidLd ?? null;

  const score = riskScore({ pha, neo, moidLd, diameter, h });
  const level = riskLevel(score);
  const mass = diameter != null ? estimateMassKg(diameter) : null;
  const velocity = a != null ? orbitalVelocityKmS(a) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <aside className="animate-rise relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-space-900/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">
              {summary.name ?? summary.fullName ?? summary.id}
            </h2>
            <p className="truncate text-sm text-zinc-400">
              {summary.fullName ?? summary.id}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn !px-2">
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="chip">{classLabel(className)}</span>
          {neo && <span className="chip text-accent">NEO</span>}
          {pha && <span className="chip !text-risk-high">PHA</span>}
          <span className={cn("chip border", RISK_BG[level])}>
            Riesgo {RISK_LABEL[level]} · {score}/100
          </span>
        </div>

        <Section title="Estimaciones (simulación)">
          <Field label="Masa estimada" value={formatMassKg(mass)} pending={!detail} />
          <Field label="Velocidad orbital" value={formatKmS(velocity)} pending={!detail} />
          <Field label="Diámetro" value={formatDiameter(diameter)} pending={!detail} />
          <Field label="Albedo" value={formatNumber(albedo, 3)} pending={!detail} />
          <Field label="Magnitud absoluta (H)" value={formatNumber(h, 2)} pending={!detail} />
        </Section>

        <Section title="Elementos orbitales">
          <Field label="Semieje mayor (a)" value={formatAu(a)} pending={!detail} />
          <Field label="Excentricidad (e)" value={formatNumber(e, 4)} pending={!detail} />
          <Field label="Inclinación (i)" value={formatDeg(i)} pending={!detail} />
          <Field label="Perihelio (q)" value={formatAu(q)} pending={!detail} />
          <Field label="Afelio (Q)" value={formatAu(ad)} pending={!detail} />
          <Field label="Periodo" value={formatYears(perY)} pending={!detail} />
          <Field label="MOID" value={formatLd(moidLd)} pending={!detail} />
          <Field
            label="Nodo ascendente (Ω)"
            value={formatDeg(detail?.om ?? null)}
            pending={!detail}
          />
          <Field
            label="Arg. perihelio (ω)"
            value={formatDeg(detail?.w ?? null)}
            pending={!detail}
          />
          <Field
            label="Anomalía media (M)"
            value={formatDeg(detail?.ma ?? null)}
            pending={!detail}
          />
        </Section>

        <Section title="Identificación">
          <Field label="ID" value={summary.id} />
          <Field label="SPK-ID" value={detail?.spkid?.toString() ?? null} pending={!detail} />
          <Field label="Designación" value={detail?.pdes ?? null} pending={!detail} />
          <Field label="Órbita" value={detail?.orbitId ?? null} pending={!detail} />
          <Field label="RMS" value={formatNumber(detail?.rms ?? null, 4)} pending={!detail} />
        </Section>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="label mb-2">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  pending,
}: {
  label: string;
  value: string | null;
  pending?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="data-num truncate text-sm text-zinc-200">
        {pending && (value == null || value === "—") ? (
          <span className="skeleton inline-block h-3.5 w-16 align-middle" />
        ) : (
          value ?? "—"
        )}
      </dd>
    </div>
  );
}
