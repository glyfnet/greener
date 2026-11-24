/**
 * `npm run fixtures:record [-- <source>...]` — record live API responses as
 * test fixtures (rule 4, Section 12.3). Run on purpose only, never in a normal
 * test run. Sources: ala, bushfire, geocode, vegetation, climate, soil. With
 * no argument, all are recorded.
 *
 * Test points are public places, not user sites: Hyde Park in central Sydney,
 * and the Katoomba escarpment in the Blue Mountains (bushfire-prone land).
 * The address fixture uses the example address from the service's own docs.
 *
 * Each fixture file is `{ url, recordedAt, status, body }`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { establishmentUrl, NEAR_QUERIES, occurrenceUrl } from "../server/src/connectors/ala.js";
import { path } from "./lib.js";

/** Public test point: Hyde Park, Sydney. Not a user site. */
export const TEST_POINT = { lat: -33.873, lon: 151.211, radiusKm: 10 };
/** Public test point on bushfire-prone land: Katoomba escarpment. Not a user site. */
export const FIRE_POINT = { lat: -33.733, lon: 150.313 };

/** Species for the live native/invasive checks: a local native, an Australian native from WA, an exotic, and an Australian native that is introduced around Sydney. */
const LIVE_SPECIES = ["Banksia serrata", "Eucalyptus marginata", "Jacaranda mimosifolia", "Grevillea robusta"];

type Target = { name: string; url: string };
const q = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params)}`;
const NAMEMATCH = "https://api.ala.org.au/namematching/api/search";

// TODO: when each connector lands, import its URL builder here instead of the literal URLs below, as for ALA.
const BUSHFIRE = "https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0/query";
const bushfireUrl = (lat: number, lon: number) =>
  q(BUSHFIRE, {
    geometry: [lon - 0.001, lat - 0.001, lon + 0.001, lat + 0.001].map((n) => n.toFixed(4)).join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "category,d_category,d_guidelin,lastupdate",
    returnGeometry: "false",
    f: "json",
  });
const ADDRESS = "https://maps.six.nsw.gov.au/services/public/Address_Location";
const VEG = "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/VIS/SVTM_NSW_1750_PCT/MapServer/identify";
const identifyParams = (lat: number, lon: number, layers: string) => ({
  geometry: `${lon},${lat}`,
  geometryType: "esriGeometryPoint",
  sr: "4326",
  layers,
  tolerance: "0",
  mapExtent: [lon - 0.01, lat - 0.01, lon + 0.01, lat + 0.01].map((n) => n.toFixed(4)).join(","),
  imageDisplay: "100,100,96",
  returnGeometry: "false",
  f: "json",
});
const CLIMATE = "https://archive-api.open-meteo.com/v1/archive";
const climateUrl = (lat: number, lon: number) =>
  q(CLIMATE, { latitude: lat.toFixed(1), longitude: lon.toFixed(1), start_date: "1991-01-01", end_date: "2020-12-31", daily: "temperature_2m_max,temperature_2m_min,precipitation_sum", timezone: "Australia/Sydney" });
const SOIL_ATTRS = ["PHC", "CLY", "SND", "SOC"];
const soilUrl = (attr: string, lat: number, lon: number) => q(`https://soils.csiro.au/arcgis/rest/services/TERN/${attr}_ACLEP_AU_TRN_N/MapServer/identify`, identifyParams(lat, lon, "all:1,5"));

const SOURCES: Record<string, Target[]> = {
  ala: [
    ...NEAR_QUERIES.map((nq) => ({ name: `occ-${nq.key}`, url: occurrenceUrl(TEST_POINT.lat, TEST_POINT.lon, TEST_POINT.radiusKm, nq) })),
    { name: "species-lomandra-longifolia", url: q("https://api.ala.org.au/species/search", { q: "Lomandra longifolia", pageSize: "5" }) },
    { name: "namematch-lomandra-longifolia", url: q(NAMEMATCH, { q: "Lomandra longifolia" }) },
    { name: "namematch-lantana-camara", url: q(NAMEMATCH, { q: "Lantana camara" }) },
    { name: "namematch-acacia-terminalis", url: q(NAMEMATCH, { q: "Acacia terminalis" }) },
    ...LIVE_SPECIES.flatMap((n) => {
      const slug = n.toLowerCase().replace(/\s+/g, "-");
      return [
        { name: `est-near-${slug}`, url: establishmentUrl(n, TEST_POINT) },
        { name: `est-aus-${slug}`, url: establishmentUrl(n) },
        { name: `namematch-${slug}`, url: q(NAMEMATCH, { q: n }) },
      ];
    }),
    { name: "namematch-not-a-plant", url: q(NAMEMATCH, { q: "Notaplant fakeus" }) },
  ],
  bushfire: [
    { name: "sydney", url: bushfireUrl(TEST_POINT.lat, TEST_POINT.lon) },
    { name: "katoomba", url: bushfireUrl(FIRE_POINT.lat, FIRE_POINT.lon) },
  ],
  geocode: [
    { name: "panorama-ave-bathurst", url: q(ADDRESS, { houseNumber: "346", roadName: "Panorama", roadType: "Ave", suburb: "Bathurst", postCode: "2795", projection: "EPSG:4326" }) },
    { name: "not-found", url: q(ADDRESS, { houseNumber: "1", roadName: "Notarealname", roadType: "St", suburb: "Bathurst", projection: "EPSG:4326" }) },
  ],
  vegetation: [
    { name: "sydney", url: q(VEG, identifyParams(TEST_POINT.lat, TEST_POINT.lon, "all:2")) },
    { name: "katoomba", url: q(VEG, identifyParams(FIRE_POINT.lat, FIRE_POINT.lon, "all:2")) },
  ],
  climate: [
    { name: "katoomba", url: climateUrl(FIRE_POINT.lat, FIRE_POINT.lon) },
  ],
  soil: SOIL_ATTRS.map((a) => ({ name: `sydney-${a.toLowerCase()}`, url: soilUrl(a, TEST_POINT.lat, TEST_POINT.lon) })),
};

const wanted = process.argv.slice(2);
for (const w of wanted) if (!SOURCES[w]) throw new Error(`unknown source ${w}; use one of ${Object.keys(SOURCES).join(", ")}`);
for (const [source, targets] of Object.entries(SOURCES)) {
  if (wanted.length && !wanted.includes(source)) continue;
  const out = path(`server/test/fixtures/${source}`);
  mkdirSync(out, { recursive: true });
  for (const t of targets) {
    const res = await fetch(t.url, { headers: { Accept: "application/json", "User-Agent": "Greener fixture recorder" }, signal: AbortSignal.timeout(60000) });
    const body: unknown = await res.json();
    const fixture = { url: t.url, recordedAt: new Date().toISOString(), status: res.status, body };
    // Large bodies (30 years of daily climate) stay on one line, so the file is not millions of lines.
    const pretty = JSON.stringify(fixture, null, 2);
    writeFileSync(`${out}/${t.name}.json`, `${pretty.length > 100_000 ? JSON.stringify(fixture) : pretty}\n`);
    console.log(`${res.status} ${source}/${t.name}`);
  }
}
