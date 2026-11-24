/**
 * Shared HTTP client for connectors (Section 12.2, FR-16, NFR-07, NFR-08).
 *
 * - Fetches only fixed, known hosts — never a URL from a user.
 * - Every fetch has a timeout.
 * - Retries 429 and 5xx with backoff, honouring Retry-After.
 * - Caches public responses in the edge cache for 7 days by default, except
 *   queries that hold a precise site location (`noCache`).
 * - Sends a contact User-Agent.
 * - Never throws: failures come back as a result, so a run can record a data
 *   gap and continue.
 */

export const ALLOWED_HOSTS = new Set([
  "biocache-ws.ala.org.au",
  "api.ala.org.au",
  // D-18: NSW RFS bushfire-prone land map.
  "portal.spatial.nsw.gov.au",
  // D-19: NSW Address Location Service.
  "maps.six.nsw.gov.au",
  // D-20: NSW State Vegetation Type Map.
  "mapprod3.environment.nsw.gov.au",
]);

/** FR-16 default cache time to live. */
export const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_TIMEOUT_MS = 8000;

/** Minimal Cache API surface, so tests can pass a fake (NFR-14). */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface HttpDeps {
  fetch: (request: Request) => Promise<Response>;
  cache?: CacheLike;
  userAgent: string;
  sleep?: (ms: number) => Promise<void>;
}

export type HttpResult<T> = { ok: true; data: T; fromCache: boolean } | { ok: false; error: string; status?: number };

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  ttlSeconds?: number;
  /** Skip the edge cache: for queries whose URL holds a precise site location (docs/privacy.md). */
  noCache?: boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchJson<T = unknown>(url: string, deps: HttpDeps, opts: FetchOptions = {}): Promise<HttpResult<T>> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "invalid URL" };
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, error: `host ${parsed.hostname} is not an allowed data service` };
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 2;
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const sleep = deps.sleep ?? defaultSleep;
  const cacheKey = new Request(parsed.toString(), { method: "GET" });

  const cache = opts.noCache ? undefined : deps.cache;
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return { ok: true, data: (await hit.json()) as T, fromCache: true };
    } catch {
      // A cache failure must not stop the call.
    }
  }

  let lastError = "unknown error";
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await deps.fetch(
        new Request(parsed.toString(), {
          method: "GET",
          headers: { Accept: "application/json", "User-Agent": deps.userAgent },
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
      if (res.ok) {
        const text = await res.text();
        let data: T;
        try {
          data = JSON.parse(text) as T;
        } catch {
          return { ok: false, error: "service returned data that is not JSON", status: res.status };
        }
        if (cache) {
          try {
            await cache.put(cacheKey, new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } }));
          } catch {
            // Ignore cache write failures.
          }
        }
        return { ok: true, data, fromCache: false };
      }
      lastStatus = res.status;
      lastError = `service returned HTTP ${res.status}`;
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get("Retry-After"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 250 * 2 ** attempt);
    } catch (e) {
      lastError = e instanceof Error && e.name === "TimeoutError" ? `service timed out after ${timeoutMs} ms` : "network error";
      if (attempt < retries) await sleep(250 * 2 ** attempt);
    }
  }
  return { ok: false, error: lastError, ...(lastStatus !== undefined ? { status: lastStatus } : {}) };
}

/** Run tasks with a small concurrency limit, to be polite to public services (NFR-08). */
export async function limited<T>(tasks: (() => Promise<T>)[], concurrency = 3): Promise<T[]> {
  const out = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      const task = tasks[i];
      if (task) out[i] = await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return out;
}
