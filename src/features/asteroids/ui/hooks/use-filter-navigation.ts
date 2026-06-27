"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { filtersToSearchParams, type AsteroidFilters } from "../../domain/filters";

/**
 * Writes the active filters into the URL (the single source of truth, so every
 * view is shareable). Updates run inside a transition, so the current UI stays
 * visible — and `loading.tsx` does not flash — while the server re-renders.
 */
export function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const commit = useCallback(
    (next: AsteroidFilters) => {
      const qs = filtersToSearchParams(next).toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname],
  );

  return { commit, pending };
}
