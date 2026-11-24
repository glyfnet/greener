/**
 * Climate normals from the Open-Meteo Historical Weather API (FR-12, D-21).
 *
 * The endpoint and fields come from the live response recorded in
 * `server/test/fixtures/climate/` (see `scripts/record-fixtures.ts`):
 *
 * - `GET https://archive-api.open-meteo.com/v1/archive` with `latitude`,
 *   `longitude`, `start_date`, `end_date`, `daily` and `timezone`.
 * - The response has `daily.time[]` (ISO dates), the parallel arrays
 *   `daily.temperature_2m_max[]`, `daily.temperature_2m_min[]` (°C) and
 *   `daily.precipitation_sum[]` (mm), and `elevation` (m).
 *
 * The data is ERA5 reanalysis (Copernicus C3S) on a grid of about 25 km. The
 * site is rounded to 1 decimal place (about 11 km), which changes nothing at
 * that grid size, so the response can be cached and shared: 30 days.
 * Terms: free non-commercial tier, CC BY 4.0, with a link to Open-Meteo
 * next to the data (D-21).
 */
import type { Citation, DataGap } from "../core/models.js";
import { fetchJson, type HttpDeps } from "./http.js";

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
export const NORMALS_PERIOD = { start: "1991-01-01", end: "2020-12-31", years: 30 } as const;
export const CLIMATE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const OPEN_METEO_URL = "https://open-meteo.com/";
export const OPEN_METEO_LICENCE = "CC BY 4.0";
/** Cold-night thresholds, in °C. The output states them; it does not call them "frost". */
export const COLD_NIGHT_THRESHOLDS = [0, 2] as const;

export function climateUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    latitude: lat.toFixed(1),
    longitude: lon.toFixed(1),
    start_date: NORMALS_PERIOD.start,
    end_date: NORMALS_PERIOD.end,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "Australia/Sydney",
  });
  return `${ARCHIVE}?${p}`;
}

interface ArchiveResponse {
  elevation?: number;
  daily?: { time?: string[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[]; precipitation_sum?: (number | null)[] };
  error?: boolean;
  reason?: string;
}

export interface MonthNormal {
  month: number;
  meanMaxC: number | null;
  meanMinC: number | null;
  rainfallMm: number | null;
}

export interface ClimateNormals {
  period: string;
  gridElevationM?: number;
  months: MonthNormal[];
  annualRainfallMm: number | null;
  /** Mean nights a year with a minimum at or below each threshold. */
  coldNightsPerYear: { atOrBelow0C: number; atOrBelow2C: number };
}

export type ClimateResult = { ok: true; normals: ClimateNormals; citation: Citation } | { ok: false; dataGap: DataGap };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Monthly normals from parallel daily arrays. Pure, so it is tested on its own. */
export function summariseDaily(time: string[], tmax: (number | null)[], tmin: (number | null)[], rain: (number | null)[], years: number): Omit<ClimateNormals, "period" | "gridElevationM"> {
  const acc = Array.from({ length: 12 }, () => ({ max: 0, nMax: 0, min: 0, nMin: 0, rain: 0, rainYears: new Set<string>() }));
  let cold0 = 0;
  let cold2 = 0;
  for (let i = 0; i < time.length; i++) {
    const t = time[i];
    if (!t) continue;
    const m = Number(t.slice(5, 7)) - 1;
    const a = acc[m];
    if (!a) continue;
    const hi = tmax[i];
    const lo = tmin[i];
    const p = rain[i];
    if (typeof hi === "number") {
      a.max += hi;
      a.nMax++;
    }
    if (typeof lo === "number") {
      a.min += lo;
      a.nMin++;
      if (lo <= COLD_NIGHT_THRESHOLDS[0]) cold0++;
      if (lo <= COLD_NIGHT_THRESHOLDS[1]) cold2++;
    }
    if (typeof p === "number") {
      a.rain += p;
      a.rainYears.add(t.slice(0, 4));
    }
  }
  const months = acc.map((a, i) => ({
    month: i + 1,
    meanMaxC: a.nMax ? r1(a.max / a.nMax) : null,
    meanMinC: a.nMin ? r1(a.min / a.nMin) : null,
    rainfallMm: a.rainYears.size ? r1(a.rain / a.rainYears.size) : null,
  }));
  const rainMonths = months.map((m) => m.rainfallMm);
  return {
    months,
    annualRainfallMm: rainMonths.every((x) => x !== null) ? r1(rainMonths.reduce<number>((s, x) => s + (x ?? 0), 0)) : null,
    coldNightsPerYear: { atOrBelow0C: r1(cold0 / years), atOrBelow2C: r1(cold2 / years) },
  };
}

export async function climateNormals(lat: number, lon: number, deps: HttpDeps, today: string): Promise<ClimateResult> {
  const url = climateUrl(lat, lon);
  const r = await fetchJson<ArchiveResponse>(url, deps, { ttlSeconds: CLIMATE_TTL_SECONDS, timeoutMs: 15000 });
  const gap = (reason: string): ClimateResult => ({ ok: false, dataGap: { topic: "climate normals", reason } });
  if (!r.ok) return gap(`Open-Meteo: ${r.error}`);
  const d = r.data.daily;
  if (r.data.error || !d?.time?.length || !d.temperature_2m_max || !d.temperature_2m_min || !d.precipitation_sum) return gap(`Open-Meteo: ${r.data.reason ?? "unexpected response"}`);
  const summary = summariseDaily(d.time, d.temperature_2m_max, d.temperature_2m_min, d.precipitation_sum, NORMALS_PERIOD.years);
  return {
    ok: true,
    normals: { period: `${NORMALS_PERIOD.start.slice(0, 4)}–${NORMALS_PERIOD.end.slice(0, 4)}`, ...(typeof r.data.elevation === "number" ? { gridElevationM: r.data.elevation } : {}), ...summary },
    citation: { id: "open-meteo:era5-normals", source: "research", title: "Weather data by Open-Meteo.com: ERA5 reanalysis (Copernicus C3S), daily 1991–2020", url: OPEN_METEO_URL, publisher: "Open-Meteo", licence: OPEN_METEO_LICENCE, accessed: today },
  };
}
