/**
 * Planning tools (Section 7.2 `action-plan`, Section 7.7, FR-20–FR-27, FR-60–FR-71).
 */
import { z } from "zod";
import { buildSpeciesIndex, checkPlan, checkSpecies } from "../core/checks.js";
import { lookupCosts } from "../core/cost.js";
import { Action, ActionPlan, LocalPrice, ResearchReport, SiteProfile } from "../core/models.js";
import { capacityFromProfile } from "../core/questionnaire.js";
import { PLAN_SECTIONS, planSection, planToMarkdown, searchSite } from "../core/render.js";
import { markDone as markDoneCore, ScheduleCapacity, schedulePlan as scheduleCore, type ScheduleResult } from "../core/schedule.js";
import { siteStrategies } from "../core/strategies.js";
import type { Citation } from "../core/models.js";
import { matchName, nativeRecordsNear } from "../connectors/ala.js";
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

/** Most species checked live per call, to stay polite to ALA (NFR-08). */
const MAX_LIVE_CHECKS = 40;

/**
 * Ask ALA for native records of species that the research lists do not
 * cover, so local natives are not blocked by D-17 just because they were
 * outside the research report's top lists.
 */
async function liveNatives(ctx: ToolContext, names: string[], location: LocationT, radiusKm: number) {
  const natives: SpeciesRecord[] = [];
  const citations: Citation[] = [];
  const gaps: string[] = [];
  const unique = [...new Set(names.map((n) => n.trim()))].slice(0, MAX_LIVE_CHECKS);
  const results = await limited(unique.map((n) => () => nativeRecordsNear(n, location.lat, location.lon, radiusKm, ctx.http, ctx.today)));
  unique.forEach((n, i) => {
    const r = results[i];
    if (!r) return;
    if (!r.ok) gaps.push(`${n}: ${r.error}`);
    else if (r.count > 0) {
      natives.push({ scientificName: n, tags: ["native"], recordCount: r.count, citationIds: [r.citation.id] });
      citations.push(r.citation);
    }
  });
  return { natives, citations, gaps };
}

/** Names that the research index alone would block only for lack of native records. */
function needsLiveCheck(names: string[], idx: ReturnType<typeof buildSpeciesIndex>): string[] {
  return names.filter((n) => {
    const v = checkSpecies(n, idx).verdict;
    return v === "not_recorded_locally" || v === "related_declared";
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
  description: "Check candidate planting species before they go in a plan (FR-22, FR-24, NFR-01, D-17). Resolves each name to the ALA taxonomy, checks it against the site research and the declared weed list, and asks ALA for native records near the site for species the research does not cover. Only local natives may be planted: blocked species must not go in the plan. Copy the returned citations into the plan.",
  input: z.object({ names: z.array(z.string().min(2)).min(1).max(40), research: ResearchReport, location: Location.optional().describe("Site location; needed to check species that are not in the research report") }),
  handler: async ({ names, research, location }, ctx) => {
    const matches = await limited(names.map((n) => () => matchName(n, ctx.http)));
    const accepted = names.map((n, i) => {
      const m = matches[i];
      return m?.ok && m.match.matched && m.match.scientificName ? m.match.scientificName : n;
    });
    let idx = buildSpeciesIndex(research, ctx.data.declaredWeeds);
    let live: Awaited<ReturnType<typeof liveNatives>> | undefined;
    if (location) {
      live = await liveNatives(ctx, needsLiveCheck(accepted, idx), location, research.radiusKm);
      idx = buildSpeciesIndex(research, ctx.data.declaredWeeds, "NSW", live.natives);
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
    let extra: SpeciesRecord[] = [];
    if (profile.location) {
      const live = await liveNatives(ctx, needsLiveCheck(planted, buildSpeciesIndex(research, ctx.data.declaredWeeds)), profile.location, research.radiusKm);
      extra = live.natives;
    }
    const check = checkPlan(p, research, profile, ctx.data.declaredWeeds, extra);
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

export const planTools = [getSiteStrategies, checkSpeciesTool, getCostReference, schedulePlanTool, markDone, savePlan, exportPlan, searchSiteTool, getPlanSection];
