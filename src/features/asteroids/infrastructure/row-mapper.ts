/**
 * Maps raw `pg` rows to domain entities and coerces Postgres types.
 *
 * `pg` returns `bigint`/`numeric` columns as strings and `float8` as numbers,
 * so we normalize everything through small, null-safe coercers.
 */

import type {
  AsteroidDetail,
  AsteroidSummary,
  OrbitalElements,
} from "../domain/asteroid";

export interface RawRow {
  [column: string]: unknown;
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce to a finite number with a default (for COUNT/required columns). */
function numOr(value: unknown, fallback: number): number {
  return num(value) ?? fallback;
}

function int(value: unknown): number {
  return Math.trunc(numOr(value, 0));
}

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

function bool(value: unknown): boolean {
  return value === true;
}

export function mapSummary(row: RawRow): AsteroidSummary {
  return {
    id: String(row.id),
    fullName: str(row.full_name),
    name: str(row.name),
    className: str(row.class),
    neo: bool(row.neo),
    pha: bool(row.pha),
    h: num(row.h),
    diameter: num(row.diameter),
    albedo: num(row.albedo),
    a: num(row.a),
    e: num(row.e),
    i: num(row.i),
    q: num(row.q),
    ad: num(row.ad),
    perY: num(row.per_y),
    moidLd: num(row.moid_ld),
  };
}

export function mapOrbital(row: RawRow): OrbitalElements {
  return {
    id: String(row.id),
    name: str(row.name),
    className: str(row.class),
    pha: bool(row.pha),
    diameter: num(row.diameter),
    a: numOr(row.a, 0),
    e: numOr(row.e, 0),
    i: numOr(row.i, 0),
    om: numOr(row.om, 0),
    w: numOr(row.w, 0),
    ma: numOr(row.ma, 0),
    n: numOr(row.n, 0),
  };
}

export function mapDetail(row: RawRow): AsteroidDetail {
  return {
    ...mapSummary(row),
    spkid: num(row.spkid),
    pdes: str(row.pdes),
    prefix: str(row.prefix),
    om: num(row.om),
    w: num(row.w),
    ma: num(row.ma),
    n: num(row.n),
    per: num(row.per),
    moid: num(row.moid),
    orbitId: str(row.orbit_id),
    epochCal: str(row.epoch_cal),
    tpCal: str(row.tp_cal),
    rms: num(row.rms),
  };
}

/** Coercers reused by the stats aggregate mapping. */
export const coerce = { num, numOr, int, str, bool };
