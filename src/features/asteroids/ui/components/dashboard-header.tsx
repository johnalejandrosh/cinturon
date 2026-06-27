import { OrbitIcon } from "@/shared/ui/icons";

/** Static dashboard header — part of the instant shell. */
export function DashboardHeader() {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="animate-float text-accent">
          <OrbitIcon width={34} height={34} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            Cinturón de Asteroides
            <span className="ml-2 text-accent">· Simulador</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Más de un millón de cuerpos del cinturón principal, en tiempo real.
          </p>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Datos orbitales: JPL Small-Body Database · Simulación con fines educativos
      </p>
    </header>
  );
}
