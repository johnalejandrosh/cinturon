"use client";

import { useEffect, useRef, useState } from "react";
import type { AsteroidSummary } from "../../../domain/asteroid";
import { classLabel } from "../../../domain/asteroid";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { SearchIcon, CloseIcon } from "@/shared/ui/icons";

/**
 * Predictive search by name / designation. Typing fetches suggestions from the
 * search route (debounced, aborting stale requests); picking one (or pressing
 * Enter) commits the term to the URL filters via `onChange`.
 */
export function SearchBox({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (q: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [items, setItems] = useState<AsteroidSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const debounced = useDebouncedValue(text.trim(), 300);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = () => {
      if (debounced.length < 1) {
        setItems([]);
        return;
      }
      setLoading(true);
      fetch(`/api/asteroids/search?q=${encodeURIComponent(debounced)}&limit=8`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: AsteroidSummary[] }) => {
          setItems(d.items ?? []);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    run();
    return () => ctrl.abort();
  }, [debounced]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (item: AsteroidSummary) => {
    const term = item.name ?? item.fullName ?? item.id;
    setText(term);
    setOpen(false);
    onChange(term);
  };

  const clear = () => {
    setText("");
    setItems([]);
    setOpen(false);
    onChange(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || items.length === 0) {
      if (e.key === "Enter" && text.trim()) onChange(text.trim());
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) pick(items[active]);
      else onChange(text.trim() || null);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-colors focus-within:border-accent/50">
        <SearchIcon className="text-zinc-400" width={18} height={18} />
        <input
          type="search"
          value={text}
          placeholder="Buscar por nombre o designación…"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          aria-label="Buscar asteroide"
          autoComplete="off"
        />
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        )}
        {text && (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpiar búsqueda"
            className="text-zinc-500 hover:text-zinc-200"
          >
            <CloseIcon width={16} height={16} />
          </button>
        )}
      </div>

      {open && items.length > 0 && (
        <ul className="glass absolute z-30 mt-2 max-h-72 w-full overflow-auto p-1 text-sm">
          {items.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(item)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  idx === active ? "bg-accent/15" : "hover:bg-white/5"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-zinc-100">
                    {item.name ?? item.fullName ?? item.id}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {item.fullName ?? item.id}
                  </span>
                </span>
                <span className="chip shrink-0">{classLabel(item.className)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
