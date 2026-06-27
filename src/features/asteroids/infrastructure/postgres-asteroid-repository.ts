import "server-only";

import type { AsteroidFilters } from "../domain/filters";
import type {
  AsteroidRepository,
  AsteroidStatsRaw,
  ClassBucket,
  ListQuery,
  OrbitSample,
  Page,
} from "../domain/ports";
import type { AsteroidDetail, AsteroidSummary } from "../domain/asteroid";
import { query } from "./db";
import { decodeCursor, encodeCursor } from "./cursor";
import {
  buildListSql,
  buildWhere,
  ParamList,
  SUMMARY_COLUMNS,
  whereClause,
  CLOSE_APPROACH_LD_SQL,
} from "./sql";
import { coerce, mapDetail, mapOrbital, mapSummary, type RawRow } from "./row-mapper";

const MAX_LIMIT = 200;

/**
 * Postgres adapter for {@link AsteroidRepository}. Every method is fully
 * parameterized and relies on the existing indexes (id PK, a, albedo, class,
 * diameter, e, h, i, name, full_name).
 */
export class PostgresAsteroidRepository implements AsteroidRepository {
  async list(queryArgs: ListQuery): Promise<Page<AsteroidSummary>> {
    const limit = Math.min(Math.max(1, queryArgs.limit), MAX_LIMIT);
    const cursor = decodeCursor(queryArgs.cursor);
    const { text, values } = buildListSql(queryArgs.filters, cursor, limit);

    const rows = await query<RawRow>(text, values);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map(mapSummary);

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      const sortVal = last.sort_val;
      nextCursor = encodeCursor({
        v: typeof sortVal === "number" ? sortVal : String(sortVal),
        id: String(last.id),
      });
    }

    return { items, nextCursor, hasMore };
  }

  async stats(filters: AsteroidFilters): Promise<AsteroidStatsRaw> {
    const p = new ParamList();
    // The close-approach threshold appears in the SELECT, so bind it first.
    const closePh = p.add(CLOSE_APPROACH_LD_SQL);
    const where = buildWhere(filters, p);

    const text = `
      SELECT
        COUNT(*)                                          AS total,
        COUNT(diameter)                                   AS with_diameter,
        AVG(diameter)                                     AS avg_diameter,
        SUM(POWER(diameter, 3))                           AS sum_d3,
        AVG(albedo)                                       AS avg_albedo,
        AVG(a)                                            AS avg_a,
        AVG(1.0 / SQRT(a)) FILTER (WHERE a > 0)           AS avg_inv_sqrt_a,
        COUNT(*) FILTER (WHERE neo)                       AS neo_count,
        COUNT(*) FILTER (WHERE pha)                       AS pha_count,
        COUNT(*) FILTER (WHERE moid_ld < ${closePh})      AS close_count,
        MIN(moid_ld)                                      AS min_moid_ld
      FROM asteroides
      ${whereClause(where)}`;

    const [row] = await query<RawRow>(text, p.values);

    return {
      total: coerce.int(row?.total),
      withDiameter: coerce.int(row?.with_diameter),
      avgDiameterKm: coerce.num(row?.avg_diameter),
      sumDiameterCubeKm3: coerce.num(row?.sum_d3),
      avgAlbedo: coerce.num(row?.avg_albedo),
      avgSemiMajorAxisAu: coerce.num(row?.avg_a),
      avgInvSqrtA: coerce.num(row?.avg_inv_sqrt_a),
      neoCount: coerce.int(row?.neo_count),
      phaCount: coerce.int(row?.pha_count),
      closeApproachCount: coerce.int(row?.close_count),
      minMoidLd: coerce.num(row?.min_moid_ld),
    };
  }

  async classDistribution(filters: AsteroidFilters): Promise<ClassBucket[]> {
    const p = new ParamList();
    const where = buildWhere(filters, p);
    where.push("class IS NOT NULL");

    const text = `
      SELECT class AS class_name, COUNT(*) AS count
      FROM asteroides
      ${whereClause(where)}
      GROUP BY class
      ORDER BY count DESC
      LIMIT 24`;

    const rows = await query<RawRow>(text, p.values);
    return rows.map((r) => ({
      className: String(r.class_name),
      count: coerce.int(r.count),
    }));
  }

  async orbitSample(filters: AsteroidFilters, limit: number): Promise<OrbitSample> {
    const safeLimit = Math.min(Math.max(1, limit), 1000000);
    const p = new ParamList();
    const where = buildWhere(filters, p);
    // Need complete elements to propagate the orbit.
    where.push(
      "a IS NOT NULL AND e IS NOT NULL AND i IS NOT NULL AND om IS NOT NULL AND w IS NOT NULL AND ma IS NOT NULL AND n IS NOT NULL",
    );
    const limitPh = p.add(safeLimit);

    // The N most significant (largest) bodies in the current filter — deterministic
    // and index-assisted (idx_asteroides_diameter), giving a meaningful belt view.
    // `COUNT(*) OVER()` returns the full plottable total in the same round trip.
    const text = `
      SELECT id, name, class, pha, diameter, a, e, i, om, w, ma, n,
             COUNT(*) OVER() AS total_count
      FROM asteroides
      ${whereClause(where)}
      ORDER BY diameter DESC NULLS LAST, id
      LIMIT ${limitPh}`;

    const rows = await query<RawRow>(text, p.values);
    const total = rows.length ? coerce.int(rows[0].total_count) : 0;
    return { items: rows.map(mapOrbital), total };
  }

  async search(term: string, limit: number): Promise<AsteroidSummary[]> {
    const trimmed = term.trim();
    if (trimmed.length < 1) return [];
    const safeLimit = Math.min(Math.max(1, limit), 25);

    const p = new ParamList();
    const escaped = trimmed.replace(/[%_\\]/g, "\\$&");
    const prefix = p.add(`${escaped}%`);
    const contains = p.add(`%${escaped}%`);
    const limitPh = p.add(safeLimit);

    // Prefix matches on name/designation rank above substring matches.
    const text = `
      SELECT ${SUMMARY_COLUMNS}
      FROM asteroides
      WHERE name ILIKE ${contains} OR full_name ILIKE ${contains} OR pdes ILIKE ${prefix}
      ORDER BY
        (name ILIKE ${prefix}) DESC,
        (name IS NULL),
        char_length(COALESCE(name, full_name, pdes, id))
      LIMIT ${limitPh}`;

    const rows = await query<RawRow>(text, p.values);
    return rows.map(mapSummary);
  }

  async getById(id: string): Promise<AsteroidDetail | null> {
    const text = `
      SELECT
        id, spkid, full_name, pdes, name, prefix, neo, pha, h, diameter, albedo,
        a, e, i, q, ad, om, w, ma, n, per, per_y, moid, moid_ld, class,
        orbit_id, epoch_cal, tp_cal, rms
      FROM asteroides
      WHERE id = $1
      LIMIT 1`;
    const rows = await query<RawRow>(text, [id]);
    return rows.length ? mapDetail(rows[0]) : null;
  }
}
