/**
 * Planning tools (Section 7.2 `action-plan`, Section 7.7, FR-20–FR-27, FR-60–FR-71).
 */
import { z } from "zod";
import { buildSpeciesIndex, checkPlan, checkSpecies, type AustraliaRecord } from "../core/checks.js";
import { lookupCosts } from "../core/cost.js";
import { nurseriesNear, type Nursery } from "../core/nurseries.js";
import { Action, ActionPlan, LocalPrice, ResearchReport, SiteProfile } from "../core/models.js";
import { capacityFromProfile } from "../core/questionnaire.js";
import { PLAN_SECTIONS, planSection, planToMarkdown, searchSite } from "../core/render.js";
import { markDone as markDoneCore, ScheduleCapacity, schedulePlan as scheduleCore, type ScheduleResult } from "../core/schedule.js";
import { siteStrategies } from "../core/strategies.js";
import type { Citation } from "../core/models.js";
import { matchName, speciesEstablishment } from "../connectors/ala.js";
import { limited } from "../connectors/http.js";
import type { SpeciesRecord, Location as LocationT } from "../core/models.js";
import { Location } from "../core/models.js";
import { fail, ok, type ToolContext } from "./context.js";
import { defineTool } from "./define.js";

const StartMonth = z.number().int().min(1).max(12).describe("Calendar month the plan starts (1 = January)");

const CapacitySource = {
  profile: SiteProfile.optional().describe("Site profile: capacity is read from its answers"),
  capacity: ScheduleCapacity.optional().describe("Capacity given directly; overrides the profile"),
};

function resolveCapacity(ctx: ToolContext, profile: SiteProfile | undefined, capacity: z.infer<typeof ScheduleCapacity> | undefined) {
  if (capacity) return { capacity, gaps: [] as string[] };
  if (profile) {
    const c = capacityFromProfile(ctx.data.bank, profile);
    return { capacity: { hoursPerWeek: c.capacity.hoursPerWeek, upfrontAud: c.capacity.upfrontAud, yearlyAud: c.capacity.yearlyAud }, gaps: c.gaps };
  }
  return undefined;
}

/** Keep the schedule result short: monthly rows only on request (Section 12.2). */
function compact(s: ScheduleResult, includeMonthly: boolean) {
  const { monthly, ...rest } = s;
  return includeMonthly ? s : { ...rest, monthlySummary: { months: monthly.length, peakWorkHours: Math.max(...monthly.map((m) => m.workHours)), maintenanceHoursMonth36: monthly.at(-1)?.maintenanceHours ?? 0 } };
}

/** Most species checked live per call, to stay polite to ALA (NFR-08). Each species costs 2 requests. */
const MAX_LIVE_CHECKS = 25;

/**
 * Ask ALA about species that the research lists do not cover (D-17): their
 * native and introduced records near the site, and across Australia.
 */
async function liveEvidence(ctx: ToolContext, names: string[], location: LocationT, radiusKm: number) {
  const near: SpeciesRecord[] = [];
  const australia: Record<string, AustraliaRecord> = {};
  const citations: Citation[] = [];
  const gaps: string[] = [];
  const unique = [...new Set(names.map((n) => n.trim()))].slice(0, MAX_LIVE_CHECKS);
  const scope = { lat: location.lat, lon: location.lon, radiusKm };
  const tasks = unique.flatMap((n) => [() => speciesEstablishment(n, ctx.http, ctx.today, scope), () => speciesEstablishment(n, ctx.http, ctx.today)]);
  const results = await limited(tasks);
  unique.forEach((n, i) => {
    const local = results[2 * i];
    const all = results[2 * i + 1];
    if (local?.ok) {
      const tags: SpeciesRecord["tags"] = [];
      if (local.value.native > 0) tags.push("native");
      if (local.value.introduced > 0) tags.push("introduced");
      if (tags.length) {
        near.push({ scientificName: n, tags, recordCount: local.value.total, citationIds: [local.value.citation.id] });
        citations.push(local.value.citation);
      }
    } else if (local) gaps.push(`${n} near the site: ${local.error}`);
    if (all?.ok) {
      australia[n] = { native: all.value.native, introduced: all.value.introduced, citationIds: [all.value.citation.id] };
      citations.push(all.value.citation);
    } else if (all) gaps.push(`${n} across Australia: ${all.error}`);
  });
  return { near, australia, citations, gaps };
}

/** Names that the research index alone cannot settle. */
function needsLiveCheck(names: string[], idx: ReturnType<typeof buildSpeciesIndex>): string[] {
  return names.filter((n) => {
    const v = checkSpecies(n, idx).verdict;
    return v === "not_native" || v === "related_declared";
  });
}

/** Resolve KB citation IDs to full citations from the shipped index, so the plan can copy them. */
function kbCitations(ctx: ToolContext, ids: string[]): Citation[] {
  const out: Citation[] = [];
  for (const id of ids) {
    const c = ctx.data.kbIndex.chunks.find((x) => x.chunkId === id);
    if (!c) continue;
    out.push({ id, source: "global_kb", title: c.title, ...(c.url.startsWith("http") ? { url: c.url } : {}), publisher: c.publisher, licence: c.licence, accessed: c.dateChecked });
  }
  return out;
}

function strategiesFor(ctx: ToolContext, profile: SiteProfile) {
  return siteStrategies(profile).map((s) => ({ ...s, citations: kbCitations(ctx, s.citationIds) }));
}

export const getSiteStrategies = defineTool({
  name: "get_site_strategies",
  title: "Get strategies for this site",
  description: "Get planning strategies for sites with special constraints: apartments and courtyards, rented or strata sites, and bushfire-prone land (FR-23). Use before drafting actions. Each strategy has guidance, rules for the plan, the caution tag to use, and citations to copy into the plan.",
  input: z.object({ profile: SiteProfile }),
  handler: ({ profile }, ctx) => {
    const strategies = strategiesFor(ctx, profile);
    return ok({ strategies, ...(strategies.length ? {} : { note: "No special constraints for this site." }) });
  },
});

export const checkSpeciesTool = defineTool({
  name: "check_species",
  title: "Check species for planting",
  description: "Check candidate planting species before they go in a plan (FR-22, FR-24, NFR-01, D-17). Resolves each name to the ALA taxonomy, checks it against the site research and the declared weed list, and asks ALA about species the research does not cover. Australian natives are allowed (local natives are best); invasives are blocked: priority weeds, state-flagged pests, and anything recorded as introduced near the site. Copy the returned citations into the plan.",
  input: z.object({ names: z.array(z.string().min(2)).min(1).max(40), research: ResearchReport, location: Location.optional().describe("Site location; needed to check species that are not in the research report") }),
  handler: async ({ names, research, location }, ctx) => {
    const matches = await limited(names.map((n) => () => matchName(n, ctx.http)));
    const accepted = names.map((n, i) => {
      const m = matches[i];
      return m?.ok && m.match.matched && m.match.scientificName ? m.match.scientificName : n;
    });
    let idx = buildSpeciesIndex(research, ctx.data.declaredWeeds);
    let live: Awaited<ReturnType<typeof liveEvidence>> | undefined;
    if (location) {
      live = await liveEvidence(ctx, needsLiveCheck(accepted, idx), location, research.radiusKm);
      idx = buildSpeciesIndex(research, ctx.data.declaredWeeds, "NSW", live);
    }
    const results = [];
    for (const [i, name] of names.entries()) {
      const m = matches[i];
      const acceptedName = m?.ok && m.match.matched ? m.match.scientificName : undefined;
      const check = checkSpecies(accepted[i] ?? name, idx);
      results.push({
        query: name,
        alaName: acceptedName ?? null,
        ...(m && !m.ok ? { nameCheckGap: m.error } : {}),
        ...(m?.ok && !m.match.matched ? { nameWarning: `ALA could not match '${name}'. Check the spelling (NFR-01).` } : {}),
        ...check,
      });
    }
    return ok({
      results,
      allowed: results.filter((r) => !r.blocking).map((r) => r.alaName ?? r.query),
      blocked: results.filter((r) => r.blocking).map((r) => r.alaName ?? r.query),
      citations: live?.citations ?? [],
      ...(live?.gaps.length ? { dataGaps: live.gaps } : {}),
      ...(location ? {} : { note: "No location given, so species outside the research report could not be checked live and are blocked. Pass the site location." }),
      declaredWeedListLoaded: ctx.data.declaredWeeds.length > 0,
    });
  },
});

export const getCostReference = defineTool({
  name: "get_cost_reference",
  title: "Get cost estimates",
  description: "Get dated cost ranges (AUD) for materials (FR-68). The user's local prices win over the reference table (FR-69). Items with no data come back as 'no data': do not invent a price for them (FR-70).",
  input: z.object({ items: z.array(z.string().min(1)).min(1).max(50), region: z.string().optional(), localPrices: z.array(LocalPrice).default([]) }),
  handler: ({ items, region, localPrices }, ctx) => {
    const matches = lookupCosts(items, region, ctx.data.costTable, localPrices);
    const availableItems = [...new Set(ctx.data.costTable.map((r) => `${r.item} (${r.unit}, ${r.region})`))];
    return ok({ matches, availableItems, note: "All prices are estimates. Show the date and source beside each one (FR-68). Item names must match an available item." });
  },
});

export const DEFAULT_NURSERY_RADIUS_KM = 100;

export const findNativeNurseries = defineTool({
  name: "find_native_nurseries",
  title: "Find native plant nurseries",
  description:
    "Find nurseries and plant stalls that specialise in Australian native plants near the site (FR-20 local resources, D-17). Returns name, town, distance, what they offer, how to visit, a website and a citation for each. Add the ones the user may use to the plan's localResources. The directory is small and growing; it says when there is nothing nearby.",
  input: z.object({ location: Location, radiusKm: z.number().min(5).max(300).default(DEFAULT_NURSERY_RADIUS_KM) }),
  handler: ({ location, radiusKm }, ctx) => {
    const near = nurseriesNear(ctx.data.nurseries, location.lat, location.lon, radiusKm);
    const citation = (n: Nursery): Citation => ({ id: `nursery:${n.id}`, source: "research", title: `${n.name} (native plant ${n.kind === "market_stall" ? "stall" : "nursery"}, ${n.town})`, url: n.sourceUrl, publisher: n.name, accessed: n.asOf });
    const results = near.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      town: n.town,
      council: n.council,
      distanceKm: n.distanceKm,
      ...(n.coordPrecision === "town" ? { distanceNote: "Distance to the town centre." } : {}),
      mailOrder: n.mailOrder,
      offers: n.offers,
      visiting: n.visiting,
      ...(n.website ? { website: n.website } : {}),
      checkedOn: n.asOf,
      localResource: { title: `${n.name}, ${n.town}: native plants`, url: n.website ?? n.sourceUrl, citationId: `nursery:${n.id}` },
      citation: citation(n),
    }));
    const notes = [
      "Ask for local provenance stock: plants grown from seed collected near the site. Check every species with check_species before it goes in the plan.",
      "Opening hours, stall dates and stock change. Tell the user to check with the nursery before they go.",
    ];
    if (!results.length) {
      return ok({
        nurseries: [],
        radiusKm,
        dataGap: { topic: "native plant nurseries", reason: `No native nurseries in Greener's directory within ${radiusKm} km. The directory covers the Armidale and Uralla area so far.` },
        nextStep: "Suggest the user ask their council, Landcare group or the local Australian Plants Society group for native nurseries. Do not invent nursery names.",
        notes,
      });
    }
    return ok({ nurseries: results, radiusKm, notes, nextStep: "Add the nurseries the user may use to plan.localResources (use each localResource) and copy each citation into plan.citations." });
  },
});

export const schedulePlanTool = defineTool({
  name: "schedule_plan",
  title: "Put actions into phases",
  description: "Put plan actions into phases that fit the user's hours and budget (Section 7.7, FR-63–FR-67). Give the actions with estimates, and either the profile or the capacity. Returns phases, a budget table, deferred actions with reasons, and what more time or money would add. Do this with the tool, not by judgment.",
  input: z.object({ actions: z.array(Action).min(1).max(200), startMonth: StartMonth, ...CapacitySource, includeMonthly: z.boolean().default(false) }),
  handler: ({ actions, startMonth, profile, capacity, includeMonthly }, ctx) => {
    const cap = resolveCapacity(ctx, profile, capacity);
    if (!cap) return fail("Give the site profile or the capacity.", ["Pass profile (from profile.json) or capacity { hoursPerWeek, upfrontAud, yearlyAud }."]);
    const result = scheduleCore({ actions, capacity: cap.capacity, startMonth });
    return ok({ ...compact(result, includeMonthly), capacityUsed: cap.capacity, capacityGaps: cap.gaps });
  },
});

export const markDone = defineTool({
  name: "mark_done",
  title: "Mark an action done",
  description: "Mark one action as done with its actual hours and cost, and reschedule the rest (FR-71). Save the returned actions back into the plan.",
  input: z.object({
    actions: z.array(Action).min(1).max(200),
    actionId: z.string().min(1),
    month: z.number().int().min(1).max(36).describe("Plan month the action was finished in (1 = first month)"),
    actualHours: z.number().nonnegative(),
    actualCostAud: z.number().nonnegative(),
    startMonth: StartMonth,
    ...CapacitySource,
  }),
  handler: ({ actions, actionId, month, actualHours, actualCostAud, startMonth, profile, capacity }, ctx) => {
    const cap = resolveCapacity(ctx, profile, capacity);
    if (!cap) return fail("Give the site profile or the capacity.", ["Pass profile or capacity."]);
    const done = { month, hours: actualHours, costAud: actualCostAud };
    const result = markDoneCore({ actions, capacity: cap.capacity, startMonth }, actionId, done);
    return ok({ actions: actions.map((a) => (a.id === actionId ? { ...a, done } : a)), schedule: compact(result, false) });
  },
});

export const savePlan = defineTool({
  name: "save_plan",
  title: "Check and save the plan",
  description: "Validate the plan against its schema, then run the native-species, weed, citation and site-constraint checks (FR-22–FR-25). Refuses a plan that plants a weed or has broken citations; fix the listed items and call again. Apartment, rented and bushfire-prone sites are accepted: missing cautions come back as warnings with the strategy that fixes them. On success, save the plan as plans/v<version>.json and export it as Markdown.",
  input: z.object({ plan: z.unknown(), research: ResearchReport, profile: SiteProfile, startMonth: StartMonth.optional() }),
  handler: async ({ plan, research, profile, startMonth }, ctx) => {
    const parsed = ActionPlan.safeParse(plan);
    if (!parsed.success) return fail("The plan does not match the schema.", parsed.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`));
    const p = parsed.data;
    // D-17: confirm natives that the research lists do not cover.
    const planted = [...p.plantingList, ...p.actions.flatMap((a) => a.plantings)].map((x) => x.scientificName);
    const live = profile.location ? await liveEvidence(ctx, needsLiveCheck(planted, buildSpeciesIndex(research, ctx.data.declaredWeeds)), profile.location, research.radiusKm) : {};
    const check = checkPlan(p, research, profile, ctx.data.declaredWeeds, live);
    if (!check.ok) return fail("The plan was refused. Fix these items and call save_plan again.", check.errors.map((e) => `${e.actionId ? `${e.actionId}: ` : ""}${e.message}`));
    let schedule;
    if (startMonth) {
      const cap = resolveCapacity(ctx, profile, undefined);
      if (cap) schedule = compact(scheduleCore({ actions: p.actions, capacity: cap.capacity, startMonth }), false);
    }
    const strategies = strategiesFor(ctx, profile);
    return ok({ plan: p, warnings: check.warnings, species: check.species, ...(strategies.length ? { strategies } : {}), ...(schedule ? { schedule } : {}), saveAs: `plans/v${p.version}.json`, ...(check.warnings.length ? { nextStep: "Show the warnings to the user. Fix them with the strategy each one names, then save again." } : {}) });
  },
});

export const exportPlan = defineTool({
  name: "export_plan",
  title: "Export the plan",
  description: "Export a saved plan as Markdown or JSON (FR-50), with sources and attribution (NFR-17). Pass startMonth and the profile to include phases and the budget table.",
  input: z.object({ plan: ActionPlan, format: z.enum(["markdown", "json"]).default("markdown"), research: ResearchReport.optional(), profile: SiteProfile.optional(), startMonth: StartMonth.optional() }),
  handler: ({ plan, format, research, profile, startMonth }, ctx) => {
    if (format === "json") return ok({ format, fileName: `plan-v${plan.version}.json`, json: plan });
    let schedule: ScheduleResult | undefined;
    const cap = resolveCapacity(ctx, profile, undefined);
    if (startMonth && cap) schedule = scheduleCore({ actions: plan.actions, capacity: cap.capacity, startMonth });
    const markdown = planToMarkdown(plan, schedule, research);
    return ok({ format, fileName: `plan-v${plan.version}.md`, markdown }, markdown);
  },
});

export const searchSiteTool = defineTool({
  name: "search_site",
  title: "Search the site file",
  description: "Search the user's own site data (profile, research and plan) for a question (FR-30). Pass the parts of the site file you have. Results carry citation IDs to keep in the answer (FR-31).",
  input: z.object({ query: z.string().min(2).max(300), profile: SiteProfile.optional(), research: ResearchReport.optional(), plan: ActionPlan.optional() }),
  handler: ({ query, profile, research, plan }) => {
    const hits = searchSite(query, { ...(profile ? { profile } : {}), ...(research ? { research } : {}), ...(plan ? { plan } : {}) });
    return ok({ hits, ...(hits.length ? {} : { note: "Nothing in the site data matches. Say so; do not guess (FR-32)." }) });
  },
});

export const getPlanSection = defineTool({
  name: "get_plan_section",
  title: "Get one part of the plan",
  description: "Get one section of a plan, or one action by ID. Use to answer a question about the plan without reading all of it.",
  input: z.object({ plan: ActionPlan, section: z.enum(PLAN_SECTIONS), actionId: z.string().optional() }),
  handler: ({ plan, section, actionId }) => ok({ section, ...(actionId ? { actionId } : {}), data: planSection(plan, section, actionId) }),
});

export const planTools = [getSiteStrategies, checkSpeciesTool, getCostReference, findNativeNurseries, schedulePlanTool, markDone, savePlan, exportPlan, searchSiteTool, getPlanSection];
