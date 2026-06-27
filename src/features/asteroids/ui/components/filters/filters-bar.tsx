"use client";

import { useEffect, useRef, useState } from "react";
import {
  BOUNDS,
  DEFAULT_FILTERS,
  SORTS,
  SORT_KEYS,
  filtersToQueryString,
  hasActiveFilters,
  type AsteroidFilters,
  type SortKey,
  type TriState,
} from "../../../domain/filters";
import { KNOWN_CLASSES } from "../../../domain/asteroid";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/lib/cn";
import { InfoIcon, ResetIcon } from "@/shared/ui/icons";
import { useFilterNavigation } from "../../hooks/use-filter-navigation";
import { RangeSlider } from "./range-slider";
import { SearchBox } from "./search-box";

/**
 * The filter cockpit. Holds a local `draft` for instant UI feedback while a
 * 300 ms debounce mirrors it into the URL (the shareable source of truth).
 * External URL changes (reset, random mode, back/forward) re-seed the draft.
 */
export function FiltersBar({ filters }: { filters: AsteroidFilters }) {
  const { commit, pending } = useFilterNavigation();
  const [draft, setDraft] = useState<AsteroidFilters>(filters);

  const urlKey = filtersToQueryString(filters);
  const urlKeyRef = useRef(urlKey);
  const filtersRef = useRef(filters);
  const draftRef = useRef(draft);

  // Mirror the latest values into refs (in an effect, not during render).
  useEffect(() => {
    urlKeyRef.current = urlKey;
    filtersRef.current = filters;
    draftRef.current = draft;
  });

  // Re-seed the draft whenever the URL changes from elsewhere.
  useEffect(() => {
    setDraft(filtersRef.current);
  }, [urlKey]);

  const debouncedKey = useDebouncedValue(filtersToQueryString(draft), 300);

  useEffect(() => {
    if (debouncedKey !== urlKeyRef.current) commit(draftRef.current);
  }, [debouncedKey, commit]);

  const update = (patch: Partial<AsteroidFilters>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const toggleClass = (code: string) =>
    setDraft((d) => ({
      ...d,
      classes: d.classes.includes(code)
        ? d.classes.filter((c) => c !== code)
        : [...d.classes, code],
    }));

  const active = hasActiveFilters(draft);

  return (
    <section className="panel space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <SearchBox
            key={draft.q ?? "__all__"}
            value={draft.q}
            onChange={(q) => update({ q })}
          />
        </div>
        <div className="flex items-center gap-2">
          <SortControl
            sort={draft.sort}
            dir={draft.dir}
            onSort={(sort) => update({ sort })}
            onDir={(dir) => update({ dir })}
          />
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_FILTERS)}
            disabled={!active}
            className="btn"
            title="Restablecer filtros"
          >
            <ResetIcon width={16} height={16} />
            <span className="hidden sm:inline">Reiniciar</span>
          </button>
          {pending && (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
              aria-label="Actualizando"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
        <RangeSlider
          label="Tamaño (km)"
          hint="Diámetro del asteroide en kilómetros. Los mayores son los más fáciles de detectar."
          bounds={BOUNDS.diameter}
          value={draft.diameter}
          onChange={(diameter) => update({ diameter })}
          format={(n) => `${n}`}
        />
        <RangeSlider
          label="Reflectividad (albedo)"
          hint="Qué fracción de la luz solar refleja: 0 = muy oscuro (carbón), 1 = muy brillante (hielo/espejo)."
          bounds={BOUNDS.albedo}
          value={draft.albedo}
          onChange={(albedo) => update({ albedo })}
          format={(n) => n.toFixed(2)}
        />
        <RangeSlider
          label="Distancia al Sol (UA)"
          hint="Distancia media a la que orbita. 1 UA = distancia Tierra–Sol (≈ 150 millones de km)."
          bounds={BOUNDS.a}
          value={draft.a}
          onChange={(a) => update({ a })}
          format={(n) => n.toFixed(2)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label mr-1 inline-flex items-center">
            Tipo de órbita
            <Hint text="Familia a la que pertenece el asteroide según la forma y el tamaño de su órbita." />
          </span>
          {KNOWN_CLASSES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => toggleClass(c.code)}
              title={`${c.label} (${c.code})`}
              className={cn(
                "chip",
                draft.classes.includes(c.code) && "chip-active",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <TriToggle
          label="Cercano a la Tierra"
          hint="NEO (Near-Earth Object): su órbita lo acerca a la vecindad de la Tierra."
          value={draft.neo}
          onChange={(neo) => update({ neo })}
        />
        <TriToggle
          label="Potencialmente peligroso"
          hint="PHA: cuerpo grande cuya órbita puede pasar muy cerca de la Tierra. No implica impacto inminente."
          value={draft.pha}
          onChange={(pha) => update({ pha })}
        />
      </div>
    </section>
  );
}

/** Small info affordance: an ⓘ icon with a plain-language tooltip. */
function Hint({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      title={text}
      aria-label={text}
      className="ml-1 inline-flex cursor-help align-middle text-zinc-500 transition-colors hover:text-accent"
    >
      <InfoIcon width={13} height={13} />
    </span>
  );
}

function TriToggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
  hint?: string;
}) {
  const options: { v: TriState; label: string }[] = [
    { v: null, label: "Todos" },
    { v: true, label: "Sí" },
    { v: false, label: "No" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="label inline-flex items-center">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-white/10">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "px-2.5 py-1 text-xs transition-colors",
              value === o.v
                ? "bg-accent/20 text-accent"
                : "text-zinc-400 hover:bg-white/5",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortControl({
  sort,
  dir,
  onSort,
  onDir,
}: {
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (s: SortKey) => void;
  onDir: (d: "asc" | "desc") => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="label hidden sm:inline">Ordenar</span>
      <select
        value={sort}
        onChange={(e) => onSort(e.target.value as SortKey)}
        aria-label="Ordenar por"
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {SORT_KEYS.map((k) => (
          <option key={k} value={k} className="bg-space-900">
            {SORTS[k]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onDir(dir === "asc" ? "desc" : "asc")}
        className="btn !px-2"
        title={dir === "asc" ? "Ascendente" : "Descendente"}
        aria-label="Cambiar dirección de orden"
      >
        <span className="data-num text-sm">{dir === "asc" ? "↑" : "↓"}</span>
      </button>
    </div>
  );
}
