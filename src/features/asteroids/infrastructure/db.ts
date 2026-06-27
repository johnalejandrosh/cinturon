import "server-only";
import { Pool, type PoolConfig, type QueryResultRow } from "pg";

/**
 * Lazy, hot-reload-safe Postgres connection pool.
 *
 * The pool is created on first query (never at import time), so building the app
 * — or rendering the static shell — does not require a reachable database. In
 * development we stash it on `globalThis` to avoid leaking pools across HMR.
 */

declare global {
  var __asteroidPgPool: Pool | undefined;
}

function buildConfig(): PoolConfig {
  const max = Number(process.env.DB_POOL_MAX ?? 10) || 10;
  const ssl =
    process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined;

  const common: PoolConfig = {
    max,
    ssl,
    // Protect the UI and the DB from runaway queries.
    statement_timeout: 15_000,
    query_timeout: 15_000,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 30_000,
  };

  if (process.env.DATABASE_URL) {
    return { ...common, connectionString: process.env.DATABASE_URL };
  }

  return {
    ...common,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

export function getPool(): Pool {
  if (!globalThis.__asteroidPgPool) {
    const pool = new Pool(buildConfig());
    // Never let an idle-client error crash the server.
    pool.on("error", (err) => {
      console.error("[pg] idle client error:", err.message);
    });
    globalThis.__asteroidPgPool = pool;
  }
  return globalThis.__asteroidPgPool;
}

/** Run a parameterized query and return the rows. */
export async function query<T extends QueryResultRow>(
  text: string,
  values: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values as unknown[]);
  return result.rows;
}
