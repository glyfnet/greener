/**
 * Plan export and site search (FR-50, FR-30, NFR-17).
 *
 * Exports hold species names only, never occurrence coordinates, so a
 * threatened species location is never more precise than the source
 * (NFR-10).
 */
import type { ActionPlan, Citation, ResearchReport, SiteProfile } from "./models.js";
import type { ScheduleResult } from "./schedule.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(lo: number, hi: number): string {
  return lo === hi ? `$${lo.toLocaleString("en-AU")}` : `$${lo.toLocaleString("en-AU")}–$${hi.toLocaleString("en-AU")}`;
}

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * A Markdown link. The URL goes in angle brackets, so characters such as
 * `*`, `_` and `)` in a query string can't break the link or turn into
 * emphasis. Brackets in the text are escaped.
 */
export function mdLink(text: string, url?: string): string {
  const t = text.replace(/([[\]\\])/g, "\\$1");
  return url ? `[${t}](<${url.replace(/[<>\s]/g, encodeURIComponent)}>)` : t;
}

function cite(ids: string[]): string {
  return ids.length ? ` [${ids.join(", ")}]` : "";
}

/** Attribution lines for every licensed source used (NFR-17). */
export function attributions(citations: Citation[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of citations) {
    const key = `${c.publisher ?? c.title}|${c.licence ?? ""}`;
    if (seen.has(key) || (!c.licence && !c.publisher)) continue;
    seen.add(key);
    out.push(`${mdLink(c.publisher ?? c.title, c.url)}${c.licence ? `, licensed ${c.licence}` : ""}`);
  }
  return out;
}

/** Render a plan as Markdown (FR-50). */
export function planToMarkdown(plan: ActionPlan, schedule?: ScheduleResult, research?: ResearchReport): string {
  const L: string[] = [];
  L.push(`# Biodiversity action plan, version ${plan.version}`, "", `Created ${plan.createdAt}.`, "");
  L.push("## Goals", "", ...plan.goals.map((g) => `- ${g}`), "");
  if (plan.quickWins.length) {
    const byId = new Map(plan.actions.map((a) => [a.id, a]));
    L.push("## Quick wins", "", ...plan.quickWins.map((id) => `- ${byId.get(id)?.title ?? id} (${id})`), "");
  }
  L.push("## Actions", "");
  for (const a of plan.actions) {
    L.push(`### ${a.id}: ${a.title}`, "");
    L.push(`- Category: ${a.category.replace(/_/g, " ")} · Priority: ${a.priority} · Effort: ${a.effort}`);
    L.push(`- Season: ${a.season.join(", ")} · Work window: ${MONTHS[a.window.startMonth - 1]}–${MONTHS[a.window.endMonth - 1]}`);
    L.push(`- Labour: ${a.labourHours.low}–${a.labourHours.high} hours · Upkeep after: ${a.maintenanceHoursPerMonth} hours a month`);
    L.push(`- Materials: ${a.materialsAud ? `${money(a.materialsAud.low, a.materialsAud.high)} (estimate${a.costAsOf ? `, prices as of ${a.costAsOf}` : ""})` : "no cost data"}`);
    if (a.dependsOn.length) L.push(`- Do after: ${a.dependsOn.join(", ")}`);
    if (a.targetSpecies.length) L.push(`- Target species: ${a.targetSpecies.join(", ")}`);
    L.push("", `Why: ${a.rationale}${cite(a.citationIds)}`, "", "Steps:", "", ...a.steps.map((s, i) => `${i + 1}. ${s}`), "");
    if (a.cautions.length) L.push("Cautions:", "", ...a.cautions.map((c) => `- ${c.text}`), "");
  }
  if (plan.plantingList.length) {
    L.push("## Planting list", "", "| Species | Common name | Quantity | Sources |", "| --- | --- | --- | --- |");
    for (const p of plan.plantingList) L.push(`| *${cell(p.scientificName)}* | ${cell(p.commonName ?? "")} | ${p.quantity ?? ""} | ${p.citationIds.join(", ")} |`);
    L.push("");
  }
  if (schedule) {
    L.push("## Phases", "");
    for (const p of schedule.phases) L.push(`- Phase ${p.phase}, ${p.name} (${p.months}): ${p.actionIds.length ? p.actionIds.join(", ") : "none"}`);
    L.push("", "## Budget (AUD, estimates)", "", "| Period | Low | High |", "| --- | --- | --- |");
    for (const r of schedule.budgetTable.byPhase) L.push(`| ${r.label} | $${r.lowAud} | $${r.highAud} |`);
    for (const r of schedule.budgetTable.byYear) L.push(`| ${r.label} (budget $${r.budgetAud}) | $${r.lowAud} | $${r.highAud} |`);
    const last = schedule.budgetTable.runningTotal.at(-1);
    if (last) L.push(`| Running total | $${last.lowAud} | $${last.highAud} |`);
    L.push("", ...schedule.notes.map((n) => `- ${n}`), "");
    if (schedule.deferred.length) {
      L.push("## Deferred actions", "", ...schedule.deferred.map((d) => `- ${d.actionId} (${d.reason}): ${d.detail}`), "");
    }
    if (schedule.whatMoreWouldAdd) L.push("## What more time or money would add", "", schedule.whatMoreWouldAdd.summary, "");
  }
  L.push("## Monitoring", "", ...plan.monitoring.map((m) => `- ${m}`), "");
  if (plan.localResources.length) L.push("## Local resources", "", ...plan.localResources.map((r) => `- ${mdLink(r.title, r.url)}${cite([r.citationId])}`), "");
  const allCitations = [...plan.citations, ...(research?.citations ?? [])];
  L.push("## Sources", "", ...dedupe(allCitations).map((c) => `- **${c.id}**: ${mdLink(c.title, c.url)}${c.source === "local_kb" ? " (your own documents)" : ""}`), "");
  const attr = attributions(allCitations);
  if (attr.length) L.push("## Attribution", "", ...attr.map((a) => `- ${a}`), "");
  return L.join("\n");
}

function dedupe(cs: Citation[]): Citation[] {
  const m = new Map<string, Citation>();
  for (const c of cs) if (!m.has(c.id)) m.set(c.id, c);
  return [...m.values()];
}

export const PLAN_SECTIONS = ["goals", "quick_wins", "actions", "planting_list", "monitoring", "local_resources", "citations"] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];

/** One section of a plan, or one action by ID (`get_plan_section`). */
export function planSection(plan: ActionPlan, section: PlanSection, actionId?: string): unknown {
  switch (section) {
    case "goals":
      return plan.goals;
    case "quick_wins":
      return plan.actions.filter((a) => plan.quickWins.includes(a.id));
    case "actions":
      return actionId ? plan.actions.filter((a) => a.id === actionId) : plan.actions.map((a) => ({ id: a.id, title: a.title, category: a.category, priority: a.priority }));
    case "planting_list":
      return plan.plantingList;
    case "monitoring":
      return plan.monitoring;
    case "local_resources":
      return plan.localResources;
    case "citations":
      return plan.citations;
  }
}

export interface SiteHit {
  where: string;
  text: string;
  citationIds: string[];
}

/**
 * Plain keyword search over the user's own site file (`search_site`, FR-30).
 * The site file arrives with the call and is not kept (D-09).
 */
export function searchSite(query: string, site: { profile?: SiteProfile; research?: ResearchReport; plan?: ActionPlan }, limit = 8): SiteHit[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!terms.length) return [];
  const candidates: SiteHit[] = [];
  const r = site.research;
  if (r) {
    for (const [where, list] of [["research.keyNativePlants", r.keyNativePlants], ["research.keyFauna", r.keyFauna], ["research.threatenedSpecies", r.threatenedSpecies], ["research.invasiveSpecies", r.invasiveSpecies]] as const) {
      for (const s of list) candidates.push({ where, text: `${s.scientificName}${s.commonName ? ` (${s.commonName})` : ""}: ${s.tags.join(", ")}${s.recordCount !== undefined ? `, ${s.recordCount} records` : ""}`, citationIds: s.citationIds });
    }
    if (r.climateSummary) candidates.push({ where: "research.climate", text: r.climateSummary, citationIds: [] });
    if (r.soilSummary) candidates.push({ where: "research.soil", text: r.soilSummary, citationIds: [] });
    for (const g of r.dataGaps) candidates.push({ where: "research.dataGaps", text: `Data gap: ${g.topic}: ${g.reason}`, citationIds: [] });
  }
  const p = site.plan;
  if (p) {
    for (const a of p.actions) candidates.push({ where: `plan.actions.${a.id}`, text: `${a.title}. ${a.rationale} ${a.steps.join(" ")} ${a.targetSpecies.join(" ")}`, citationIds: a.citationIds });
    for (const pl of p.plantingList) candidates.push({ where: "plan.plantingList", text: `${pl.scientificName} ${pl.commonName ?? ""}`, citationIds: pl.citationIds });
  }
  const prof = site.profile;
  if (prof) for (const [id, a] of Object.entries(prof.answers)) candidates.push({ where: `profile.${id}`, text: `${id.replace(/_/g, " ")}: ${[...a.optionIds, a.other ?? "", a.notSure ? "not sure" : ""].filter(Boolean).join(", ")}`, citationIds: [] });
  return candidates
    .map((c) => ({ c, score: terms.reduce((s, t) => s + (c.text.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
