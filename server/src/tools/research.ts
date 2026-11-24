/**
 * Research tools (Section 7.2 `site-research`, FR-10–FR-16).
 */
import { z } from "zod";
import { normaliseName } from "../core/checks.js";
import { Location, ResearchReport } from "../core/models.js";
import { speciesNear, speciesProfile } from "../connectors/ala.js";
import { climateNormals as getClimate } from "../connectors/climate.js";
import { soilProperties as getSoil } from "../connectors/soil.js";
import { vegetationCommunity as getVegetation } from "../connectors/vegetation.js";
import { fail, ok } from "./context.js";
import { defineTool } from "./define.js";

export const DEFAULT_RADIUS_KM = 10;

export const alaSpeciesNear = defineTool({
  name: "ala_species_near",
  title: "Find species near the site",
  description: "Get species recorded by the Atlas of Living Australia within a radius of the site (default 10 km, FR-10). Returns native plants, introduced plants, animals, threatened species and state-flagged invasive species as short lists with counts and citation IDs (FR-11). A failed query becomes a data gap; the rest still returns (NFR-07).",
  input: z.object({ location: Location, radiusKm: z.number().min(1).max(50).default(DEFAULT_RADIUS_KM) }),
  handler: async ({ location, radiusKm }, ctx) => {
    const r = await speciesNear(location.lat, location.lon, radiusKm, ctx.http, ctx.today);
    const trim = <T extends { scientificName: string }>(xs: T[], n: number) => xs.slice(0, n);
    return ok({
      radiusKm: r.radiusKm,
      nativePlants: trim(r.nativePlants, 30),
      introducedPlants: trim(r.introducedPlants, 30),
      fauna: trim(r.fauna, 20),
      threatened: trim(r.threatened, 20),
      stateInvasive: trim(r.stateInvasive, 20),
      citations: r.citations,
      dataGaps: r.dataGaps,
      notes: [
        "Counts are numbers of ALA records, not numbers of plants or animals.",
        "Native means ALA has records with a native establishment tag nearby. Many records have no tag, so a short list is not proof of absence.",
        "Do not give the location of a threatened species more precisely than ALA does (NFR-10).",
      ],
    });
  },
});

export const alaSpeciesProfile = defineTool({
  name: "ala_species_profile",
  title: "Get a species profile",
  description: "Get the accepted ALA name, common name, family and status for one species (FR-33, NFR-01). Use for key species in the report, and for species the user asks about that are not in the site data.",
  input: z.object({ name: z.string().min(2).max(120).describe("Scientific or common name") }),
  handler: async ({ name }, ctx) => {
    const r = await speciesProfile(name, ctx.http, ctx.today);
    if (!r.ok) return ok({ found: false, dataGap: { topic: `ALA species profile for ${name}`, reason: r.error } });
    return ok({ found: true, ...r.profile });
  },
});

export const climateNormals = defineTool({
  name: "climate_normals",
  title: "Get climate normals",
  description:
    "Get 1991–2020 climate normals for the site from the Open-Meteo Historical Weather API (FR-12, D-21): monthly mean maximum and minimum temperature, monthly and annual rainfall, and mean nights a year at or below 0 °C and 2 °C. Use them to time planting and choose natives suited to the site. The grid is about 25 km, so local effects are smoothed out.",
  input: z.object({ location: Location }),
  handler: async ({ location }, ctx) => {
    const r = await getClimate(location.lat, location.lon, ctx.http, ctx.today);
    if (!r.ok) return ok({ available: false, dataGap: r.dataGap, requirement: "FR-12", nextStep: "Record this data gap in the research report and continue (NFR-07). Do not estimate the values." });
    return ok({
      available: true,
      normals: r.normals,
      citation: r.citation,
      notes: [
        "ERA5 reanalysis on a grid of about 25 km, not a weather station. Conditions at the site can differ from the grid average; ask the user what they see.",
        "Cold nights count days with a minimum air temperature at or below 0 °C or 2 °C. They are thresholds, not a definition of frost.",
        "Cite Open-Meteo with a link wherever these values are shown (CC BY 4.0).",
      ],
    });
  },
});

export const soilProperties = defineTool({
  name: "soil_properties",
  title: "Get soil properties",
  description:
    "Get modelled soil pH (CaCl₂), clay, sand and organic carbon at 0–5 cm and 5–15 cm for the site, from the Soil and Landscape Grid of Australia (FR-13, D-22). These are estimates on a 90 m grid: the user's own soil answer and a simple test on site come first.",
  input: z.object({ location: Location }),
  handler: async ({ location }, ctx) => {
    const r = await getSoil(location.lat, location.lon, ctx.http, ctx.today);
    if (!r.ok) return ok({ available: false, dataGap: r.dataGap, requirement: "FR-13", nextStep: "Record this data gap in the research report and use the user's own soil answer (NFR-07). Do not estimate the values." });
    return ok({
      available: true,
      properties: r.properties,
      units: { phCaCl2: "pH units (1:5 soil in 0.01 M CaCl₂)", clayPercent: "% of fine earth", sandPercent: "% of fine earth", organicCarbonPercent: "% by weight" },
      dataGaps: r.dataGaps,
      citation: r.citation,
      notes: [
        "Modelled estimates on a 90 m grid. Urban sites, fill and garden beds often differ. The user's own soil answer and a test on site come first.",
        "pH here is measured in calcium chloride (CaCl₂). A garden kit may use a different method, so compare like with like.",
      ],
    });
  },
});
export const vegetationCommunity = defineTool({
  name: "vegetation_community",
  title: "Get the pre-clearing vegetation community",
  description:
    "Get the likely original (pre-clearing) Plant Community Type for the site from the NSW State Vegetation Type Map (FR-14, D-20). Use it to choose local natives that belong in that community, and to explain the plan. It is a statewide model, not a site survey.",
  input: z.object({ location: Location }),
  handler: async ({ location }, ctx) => {
    const r = await getVegetation(location.lat, location.lon, ctx.http, ctx.today);
    if (!r.ok) return ok({ available: false, dataGap: r.dataGap, requirement: "FR-14", nextStep: "Record this data gap in the research report and continue (NFR-07). Do not guess the community." });
    if (!r.community) return ok({ available: false, dataGap: { topic: "pre-clearing vegetation community", reason: "The NSW State Vegetation Type Map has no community at this point." }, citation: r.citation });
    return ok({
      available: true,
      community: r.community,
      citation: r.citation,
      notes: [
        "This is the likely original vegetation before clearing, from a statewide model at 5 m resolution. It is not what grows there now, and not a site survey.",
        "Search for the community name, for example with search_knowledge or a council planting list, to find its typical local natives. Check every species with check_species.",
        ...(location.precision === "approximate" ? ["The site location is approximate, so the community may differ at the exact property."] : []),
      ],
    });
  },
});

export const weedStatus = defineTool({
  name: "weed_status",
  title: "Check declared weed status",
  description: "Check species names against the state declared weed list (FR-11, FR-24). Use for invasive species in the report and for any species the user asks about. Says clearly when the list has no data yet.",
  input: z.object({ names: z.array(z.string().min(2)).min(1).max(50), state: z.literal("NSW").default("NSW") }),
  handler: ({ names, state }, ctx) => {
    const list = ctx.data.declaredWeeds.filter((w) => w.state === state);
    const byName = new Map(list.map((w) => [normaliseName(w.scientificName), w]));
    const results = names.map((n) => {
      const w = byName.get(normaliseName(n)) ?? byName.get(normaliseName(n).split(" ").slice(0, 2).join(" "));
      return w ? { name: n, declared: true, category: w.category, sourceUrl: w.sourceUrl, asOf: w.asOf } : { name: n, declared: list.length ? false : null };
    });
    return ok({
      state,
      results,
      ...(list.length
        ? {}
        : { dataGap: { topic: `${state} declared weed list`, reason: "The declared weed list has no data yet (Section 8: To check). 'declared: null' means unknown, not 'not a weed'." } }),
    });
  },
});

export const saveResearch = defineTool({
  name: "save_research",
  title: "Check and save the research report",
  description: "Validate the research report (FR-15) against its schema. Every species must cite a citation in the report. On success, save the returned report as research.json in the user's Project. The server keeps nothing (D-09).",
  input: z.object({ research: z.unknown() }),
  handler: ({ research }) => {
    const parsed = ResearchReport.safeParse(research);
    if (!parsed.success) return fail("The report does not match the schema.", parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`));
    const r = parsed.data;
    const ids = new Set(r.citations.map((c) => c.id));
    const errors: string[] = [];
    for (const [list, xs] of Object.entries({ keyNativePlants: r.keyNativePlants, keyFauna: r.keyFauna, threatenedSpecies: r.threatenedSpecies, invasiveSpecies: r.invasiveSpecies })) {
      for (const s of xs) for (const id of s.citationIds) if (!ids.has(id)) errors.push(`${list}: ${s.scientificName} cites '${id}', which is not in citations`);
    }
    if (errors.length) return fail("Some citations do not resolve (FR-25).", errors.slice(0, 20));
    return ok({ research: r, counts: { keyNativePlants: r.keyNativePlants.length, keyFauna: r.keyFauna.length, threatenedSpecies: r.threatenedSpecies.length, invasiveSpecies: r.invasiveSpecies.length, dataGaps: r.dataGaps.length }, saveAs: "research.json" });
  },
});

export const researchTools = [alaSpeciesNear, alaSpeciesProfile, climateNormals, soilProperties, vegetationCommunity, weedStatus, saveResearch];
