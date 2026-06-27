"use client";

import type { ReactNode } from "react";
import type { DashboardStats } from "../../../application/dashboard-stats";
import { riskLevel } from "../../../domain/physics";
import { RISK_LABEL, riskGradientHex } from "../../risk";
import { useCountUp } from "@/shared/hooks/use-count-up";
import {
  formatCompact,
  formatDiameter,
  formatInt,
  formatKmS,
  formatLd,
  formatMassKg,
} from "@/shared/lib/format";
import {
  AlertIcon,
  GaugeIcon,
  OrbitIcon,
  RulerIcon,
  TargetIcon,
  WeightIcon,
} from "@/shared/ui/icons";
import { KpiCard } from "./kpi-card";

export function KpiGrid({ stats }: { stats: DashboardStats }) {
  const level = riskLevel(stats.riskIndex);
  const riskColor = riskGradientHex(stats.riskIndex);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total de asteroides"
          icon={<OrbitIcon />}
          value={stats.total}
          display={(n) => (n > 99999 ? formatCompact(n) : formatInt(n))}
          hint="en la selección actual"
        />
        <KpiCard
          label="Diámetro promedio"
          icon={<RulerIcon />}
          value={stats.avgDiameterKm ?? 0}
          display={stats.avgDiameterKm == null ? () => "—" : (n) => formatDiameter(n)}
          hint={`${formatInt(stats.withDiameter)} con diámetro medido`}
        />
        <KpiCard
          label="Masa acumulada"
          icon={<WeightIcon />}
          value={stats.estimatedTotalMassKg ?? 0}
          display={
            stats.estimatedTotalMassKg == null ? () => "—" : (n) => formatMassKg(n)
          }
          hint="estimada · ρ ≈ 2 g/cm³"
        />
        <KpiCard
          label="Velocidad orbital media"
          icon={<GaugeIcon />}
          value={stats.avgOrbitalVelocityKmS ?? 0}
          display={
            stats.avgOrbitalVelocityKmS == null ? () => "—" : (n) => formatKmS(n)
          }
          hint="aprox. vis-viva"
        />
        <KpiCard
          label="Índice de riesgo"
          icon={<AlertIcon />}
          value={stats.riskIndex}
          display={(n) => `${Math.round(n)}/100`}
          accentColor={riskColor}
          progress={stats.riskIndex}
          hint={`Riesgo ${RISK_LABEL[level].toLowerCase()}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          icon={<TargetIcon width={16} height={16} />}
          label="NEOs"
          value={stats.neoCount}
        />
        <MiniStat
          icon={<AlertIcon width={16} height={16} />}
          label="Potencialmente peligrosos"
          value={stats.phaCount}
          danger
        />
        <MiniStat
          icon={<OrbitIcon width={16} height={16} />}
          label="Cercanos (MOID < 0,05 UA)"
          value={stats.closeApproachCount}
        />
        <div className="panel flex items-center justify-between !p-3">
          <span className="label">MOID mínima</span>
          <span className="data-num text-sm text-accent">
            {formatLd(stats.minMoidLd)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  danger?: boolean;
}) {
  const animated = useCountUp(value, 700);
  return (
    <div className="panel flex items-center justify-between !p-3">
      <span className="flex items-center gap-2">
        <span className={danger ? "text-risk-high" : "text-accent"}>{icon}</span>
        <span className="label leading-tight">{label}</span>
      </span>
      <span
        className={`data-num text-sm font-semibold ${danger ? "text-risk-high" : "text-zinc-100"}`}
      >
        {formatInt(Math.round(animated))}
      </span>
    </div>
  );
}
