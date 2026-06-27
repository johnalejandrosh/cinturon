/**
 * Keyset (a.k.a. seek) cursor codec.
 *
 * Pagination uses keyset cursors instead of OFFSET so that deep pages stay
 * O(log n) against the existing indexes. A cursor encodes the sort value and the
 * `id` tiebreaker of the last row returned, so the next page can resume with a
 * single index-assisted comparison — no rows are skipped or re-scanned.
 */

export interface CursorPayload {
  /** Coalesced sort value of the last row (number for numeric sorts, string for `id`/`name`). */
  v: number | string;
  /** `id` tiebreaker — guarantees a total, stable order. */
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      "v" in parsed &&
      typeof (parsed as CursorPayload).id === "string"
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}
