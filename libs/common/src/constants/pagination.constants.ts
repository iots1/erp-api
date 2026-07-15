/**
 * Pagination safety constants — the hard ceilings shared by the HTTP validation
 * layer (`@Max` on {@link QueryParamsDTO}) and the database query layer
 * (`TypeOrmQueryBuilder`). Kept in this dependency-free file so neither layer has
 * to import a value from the other (which would create an import cycle between the
 * DTO module and the query builder).
 */

/**
 * Absolute contract ceiling for `?limit=`. Requests above this are rejected with
 * a 422 at the HTTP layer (Layer 1) — a fixed promise to API clients that only
 * changes with a rebuild.
 *
 * Set to 2000 to match `BaseSyncLookupService.FETCH_LIMIT` (the largest legitimate
 * internal page size), so the hard ceiling never rejects a bulk sync fetch. The
 * day-to-day effective cap is the lower, env-tunable `QUERY_MAX_LIMIT` (Layer 2),
 * which silently clamps within this ceiling without a rebuild.
 *
 * Invariant: `QUERY_MAX_LIMIT` must be set less than or equal to this value.
 */
export const MAX_QUERY_LIMIT = 2000;

/**
 * Maximum page number accepted on `?page=`. Caps the OFFSET the database has to
 * skip, blocking deep-paging abuse (e.g. `?page=9999999`). Unlike `limit`, page
 * is NOT covered by `QUERY_MAX_LIMIT`, so this constant is the ONLY ceiling on
 * OFFSET — there is intentionally no env knob for it.
 *
 * 10000 follows the common deep-paging cutoff (e.g. Elasticsearch's default
 * `max_result_window`): it lets a large table be fully paged at small page sizes
 * (10000 × 100 = 1,000,000 rows) while blocking absurd offsets. Beyond this,
 * clients should use filters or cursor-based paging instead of raw offsets.
 */
export const MAX_QUERY_PAGE = 10000;
