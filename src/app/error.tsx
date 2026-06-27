"use client";

import { useEffect } from "react";
import { AlertIcon, ResetIcon } from "@/shared/ui/icons";

/**
 * Route error boundary. The most likely failure here is the database being
 * unreachable or misconfigured, so the copy points the user at `.env.local`.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-risk-mid">
        <AlertIcon width={44} height={44} />
      </span>
      <h1 className="text-xl font-semibold text-zinc-100">
        No se pudieron cargar los asteroides
      </h1>
      <p className="text-sm text-zinc-400">
        Suele deberse a que la base de datos no es accesible o las variables de
        entorno son incorrectas. Revisa tu archivo{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-accent">
          .env.local
        </code>{" "}
        (host, usuario, contraseña y nombre de la base de datos) y que el
        servidor PostgreSQL esté en línea.
      </p>
      <button type="button" onClick={reset} className="btn-accent">
        <ResetIcon width={16} height={16} />
        Reintentar
      </button>
    </main>
  );
}
