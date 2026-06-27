/**
 * SQL fragment builders. Every value is bound through {@link ParamList} so the
 * adapter is parameterized end-to-end (no string interpolation of user input).
 */

import type { AsteroidFilters, SortKey } from "../domain/filters";
import { CLOSE_APPROACH_LD } from "../domain/physics";
import { type CursorPayload } from "./cursor";

/** Accumulates bound values and hands back `$n` placeholders in order. */
export class ParamList {
  readonly values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

/** Whitelisted sort key → physical column. Prevents SQL injection via `sort`. */
const SORT_COLUMN: Record<SortKey, string> = {
  id: "id",
  diameter: "diameter",
  albedo: "albedo",
  a: "a",
  e: "e",
  i: "i",
  h: "h",
  name: "name",
};

const NUMERIC_SORTS: ReadonlySet<SortKey> = new Set([
  "diameter",
  "albedo",
  "a",
  "e",
  "i",
  "h",
]);

export const CLOSE_APPROACH_LD_SQL = CLOSE_APPROACH_LD;

/**
 * Build the shared WHERE conditions from the filters. Returns the list of
 * conditions (to be joined with AND); an empty list means "no filter".
 */
export function buildWhere(filters: AsteroidFilters, p: ParamList): string[] {
  const where: string[] = [];

  const range = (col: string, min: number | null, max: number | null) => {
    if (min != null) where.push(`${col} >= ${p.add(min)}`);
    if (max != null) where.push(`${col} <= ${p.add(max)}`);
  };

  range("diameter", filters.diameter.min, filters.diameter.max);
  range("albedo", filters.albedo.min, filters.albedo.max);
  range("a", filters.a.min, filters.a.max);

  if (filters.classes.length > 0) {
    where.push(`class = ANY(${p.add(filters.classes)}::text[])`);
  }
  if (filters.neo != null) where.push(`neo = ${p.add(filters.neo)}`);
  if (filters.pha != null) where.push(`pha = ${p.add(filters.pha)}`);

  if (filters.q) {
    const pattern = `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`;
    const ph = p.add(pattern);
    where.push(`(full_name ILIKE ${ph} OR name ILIKE ${ph} OR pdes ILIKE ${ph})`);
  }

  return where;
}

export function whereClause(conditions: string[]): string {
  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

/** Light projection selected for list rows (keeps the payload small). */
export const SUMMARY_COLUMNS = `
  id, full_name, name, class, neo, pha, h, diameter, albedo,
  a, e, i, q, ad, per_y, moid_ld`;

export interface ListSql {
  text: string;
  values: unknown[];
  /** When true the keyset uses a compound (sortVal, id) comparison. */
  compound: boolean;
}

/**
 * Build the keyset list query. `limit` rows are requested + 1 sentinel row to
 * detect whether another page exists.
 */
export function buildListSql(
  filters: AsteroidFilters,
  cursor: CursorPayload | null,
  limit: number,
): ListSql {
  const p = new ParamList();
  const sort = filters.sort;
  const dir = filters.dir;
  const cmp = dir === "asc" ? ">" : "<";
  const dirSql = dir === "asc" ? "ASC" : "DESC";

  // Sort by `id` is the fast path: single-column keyset on the primary key.
  if (sort === "id") {
    const where = buildWhere(filters, p);
    if (cursor) where.push(`id ${cmp} ${p.add(cursor.id)}`);
    const limitPh = p.add(limit + 1);
    const text = `
      SELECT ${SUMMARY_COLUMNS}, id AS sort_val
      FROM asteroides
      ${whereClause(where)}
      ORDER BY id ${dirSql}
      LIMIT ${limitPh}`;
    return { text, values: p.values, compound: false };
  }

  // Other columns: total-order keyset using COALESCE(col, sentinel) + id.
  const col = SORT_COLUMN[sort];
  const isNumeric = NUMERIC_SORTS.has(sort);

  // Sentinel pushes NULLs to the correct end so the order is total.
  const sentinelPh = isNumeric
    ? p.add(dir === "asc" ? 1e308 : -1e308)
    : p.add(dir === "asc" ? "￿￿￿￿" : "");
  const cast = isNumeric ? "::float8" : "::text";
  const orderExpr = `COALESCE(${col}, ${sentinelPh}${cast})`;

  const where = buildWhere(filters, p);
  if (cursor) {
    const vPh = p.add(cursor.v);
    const idPh = p.add(cursor.id);
    where.push(`(${orderExpr}, id) ${cmp} (${vPh}${cast}, ${idPh})`);
  }
  const limitPh = p.add(limit + 1);

  const text = `
    SELECT ${SUMMARY_COLUMNS}, ${orderExpr} AS sort_val
    FROM asteroides
    ${whereClause(where)}
    ORDER BY ${orderExpr} ${dirSql}, id ${dirSql}
    LIMIT ${limitPh}`;

  return { text, values: p.values, compound: true };
}
