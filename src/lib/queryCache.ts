/**
 * queryCache.ts — lightweight in-memory query cache.
 *
 * Implements the three patterns that make data-fetching fast at scale:
 *
 *  1. TTL-based expiry        — serve fresh data, discard data older than `ttl`
 *  2. In-flight deduplication — N concurrent callers share ONE Promise; no duplicate HTTP requests
 *  3. Stale-while-revalidate  — return stale data instantly so the UI never shows a spinner
 *                               while silently fetching fresh data in the background
 *
 * Usage:
 *
 *   import { fetchCached, fetchSWR, invalidatePrefix, cacheKey } from "@/lib/queryCache";
 *
 *   // Build a stable key from endpoint + params
 *   const key = cacheKey("users", { page: 1, limit: 25, search: "nikhil" });
 *
 *   // Hard fetch — wait for fresh data (or return still-fresh cache hit)
 *   const data = await fetchCached(key, () => getData({ endpoint: "users", ... }));
 *
 *   // SWR fetch — return stale data immediately + background-refresh
 *   const data = await fetchSWR(key, fetcher, 30_000, (fresh) => setData(fresh));
 *
 *   // After a mutation, mark the resource stale so next access re-fetches
 *   invalidatePrefix("users");
 */

// ─── Internal store ────────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  data:     T;
  storedAt: number;             // Date.now() when last stored
  promise?: Promise<T>;         // in-flight request — cleared on resolve/reject
}

const store = new Map<string, CacheEntry>();

// ─── Key builder ───────────────────────────────────────────────────────────────

/**
 * Build a stable, canonical cache key from an endpoint and optional params.
 * Params are sorted so { page:1, limit:25 } and { limit:25, page:1 } produce the same key.
 */
export function cacheKey(
  endpoint: string,
  params?: Record<string, unknown>,
): string {
  if (!params || Object.keys(params).length === 0) return endpoint;
  const stable = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
        acc[k] = params[k];
      }
      return acc;
    }, {});
  return `${endpoint}::${JSON.stringify(stable)}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(entry: CacheEntry, ttl: number): boolean {
  return Date.now() - entry.storedAt > ttl;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Return the current cached value for `key`, or undefined if absent. */
export function getCached<T>(key: string): T | undefined {
  return (store.get(key)?.data) as T | undefined;
}

/** Check whether a key exists and is still within its TTL. */
export function isFresh(key: string, ttl: number): boolean {
  const entry = store.get(key);
  return !!entry && !isExpired(entry, ttl);
}

/** Manually store a value (e.g. optimistic update after a mutation). */
export function setCached<T>(key: string, data: T): void {
  const existing = store.get(key);
  store.set(key, { data, storedAt: Date.now(), promise: existing?.promise });
}

/** Remove a single cache key. */
export function invalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate every key whose prefix matches `prefix`.
 * e.g. invalidatePrefix("users") removes "users", "users::…", "users/…"
 */
export function invalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k === prefix || k.startsWith(`${prefix}::`) || k.startsWith(`${prefix}/`)) {
      store.delete(k);
    }
  }
}

/** Wipe the entire cache (e.g. on logout). */
export function invalidateAll(): void {
  store.clear();
}

// ─── fetchCached ───────────────────────────────────────────────────────────────

/**
 * Fetch with TTL + in-flight deduplication.
 *
 * • Cache hit (fresh)  → return immediately, zero network.
 * • In-flight          → return the existing Promise, zero duplicate requests.
 * • Cache miss / stale → call `fetcher`, cache the result, return it.
 */
export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 60_000,
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;

  // 1. Fresh hit
  if (entry && entry.data !== undefined && !isExpired(entry, ttl)) {
    return entry.data;
  }

  // 2. In-flight dedup
  if (entry?.promise) {
    return entry.promise;
  }

  // 3. New request
  const promise: Promise<T> = fetcher().then(
    (data) => {
      // Clear the in-flight reference and store fresh data
      store.set(key, { data, storedAt: Date.now() });
      return data;
    },
    (err) => {
      // Clear in-flight so the next call retries; preserve any stale data
      const e = store.get(key) as CacheEntry<T> | undefined;
      if (e) {
        const { promise: _, ...rest } = e;
        store.set(key, rest as CacheEntry<unknown>);
      } else {
        store.delete(key);
      }
      throw err;
    },
  );

  store.set(key, {
    data:     entry?.data as T,
    storedAt: entry?.storedAt ?? 0,
    promise,
  });

  return promise;
}

// ─── fetchSWR ──────────────────────────────────────────────────────────────────

/**
 * Stale-while-revalidate fetch.
 *
 * • Fresh data          → return immediately, no network.
 * • Stale data          → return stale data immediately so the UI has something to
 *                         render, AND kick off a background refresh. When the refresh
 *                         completes `onRevalidate(freshData)` is called so the
 *                         component can update its state.
 * • No data at all      → behaves like fetchCached (blocks until data arrives).
 *
 * @param staleTime   How old (ms) data can be before triggering a revalidation (default 30 s).
 *                    The data remains usable until it exceeds `ttl` (default 60 s),
 *                    i.e. staleTime ≤ ttl.
 * @param onRevalidate  Called with fresh data after a background refresh completes.
 */
export async function fetchSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  staleTime = 30_000,
  ttl = 60_000,
  onRevalidate?: (fresh: T) => void,
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;

  // Fresh — no network needed
  if (entry && entry.data !== undefined && !isExpired(entry, staleTime)) {
    return entry.data;
  }

  // Stale — serve immediately + background refresh
  if (entry?.data !== undefined && !isExpired(entry, ttl) && !entry.promise) {
    const promise: Promise<T> = fetcher().then(
      (fresh) => {
        store.set(key, { data: fresh, storedAt: Date.now() });
        onRevalidate?.(fresh);
        return fresh;
      },
      () => entry.data, // on error keep using stale
    ).finally(() => {
      const e = store.get(key) as CacheEntry<T> | undefined;
      if (e) { const { promise: _, ...rest } = e; store.set(key, rest as CacheEntry<unknown>); }
    });
    store.set(key, { ...entry, promise });
    return entry.data; // serve stale right now
  }

  // No data (or fully expired) — wait for first fetch
  return fetchCached(key, fetcher, ttl);
}
