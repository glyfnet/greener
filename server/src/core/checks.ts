/**
 * Native, weed and constraint checks (FR-22–FR-25, NFR-03).
 *
 * These rules must never fail silently, so they live in tested code, not in
 * skills (rule 6). `save_plan` runs `checkPlan` and refuses the plan when it
 * returns any error.
 */
import type { ActionPlan, ResearchReport, SiteProfile, SpeciesRecord } from "./models.js";

export type SpeciesVerdict = "local_native" | "mixed_records" | "not_recorded_locally" | "introduced" | "declared_weed" | "biosecurity_pest";

export interface SpeciesCheck {
  name: string;
  verdict: SpeciesVerdict;
  /** True when the species must not go in a planting list. */
  blocking: boolean;
  message: string;
  citationIds: string[];
}

/** A declared weed row from `data/declared-weeds.csv`. */
export interface DeclaredWeed {
  scientificName: string;
  state: string;
  category: string;
  sourceUrl: string;
  asOf: string;
}

export interface SpeciesIndex {
  native: Map<string, SpeciesRecord>;
  introduced: Map<string, SpeciesRecord>;
  biosecurity: Map<string, SpeciesRecord>;
  declared: Map<string, DeclaredWeed>;
}

/** Lower case, single spaces, no authorship after the binomial's rank markers. */
export function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Genus + species epithet, used so an infraspecific name matches its species. */
function binomial(name: string): string {
  return normaliseName(name).split(" ").slice(0, 2).join(" ");
}

function lookup<T>(map: Map<string, T>, name: string): T | undefined {
  return map.get(normaliseName(name)) ?? map.get(binomial(name));
}

export function buildSpeciesIndex(research: Pick<ResearchReport, "keyNativePlants" | "keyFauna" | "threatenedSpecies" | "invasiveSpecies">, declaredWeeds: DeclaredWeed[], state = "NSW"): SpeciesIndex {
  const idx: SpeciesIndex = { native: new Map(), introduced: new Map(), biosecurity: new Map(), declared: new Map() };
  const all = [...research.keyNativePlants, ...research.keyFauna, ...research.threatenedSpecies, ...research.invasiveSpecies];
  for (const r of all) {
    const key = normaliseName(r.scientificName);
    if (r.tags.includes("native")) idx.native.set(key, r);
    if (r.tags.includes("introduced")) idx.introduced.set(key, r);
    if (r.tags.includes("biosecurity_pest")) idx.biosecurity.set(key, r);
  }
  for (const w of declaredWeeds) if (w.state === state) idx.declared.set(normaliseName(w.scientificName), w);
  return idx;
}

/**
 * Check one species for planting. Weed and pest checks run first and win over
 * any native record, so a declared weed is always blocked (FR-24, NFR-03).
 */
export function checkSpecies(name: string, idx: SpeciesIndex): SpeciesCheck {
  const declared = lookup(idx.declared, name);
  if (declared) {
    return { name, verdict: "declared_weed", blocking: true, message: `${name} is a declared weed in ${declared.state} (${declared.category}). Do not plant it.`, citationIds: [`weeds:${declared.state.toLowerCase()}`] };
  }
  const pest = lookup(idx.biosecurity, name);
  if (pest) {
    return { name, verdict: "biosecurity_pest", blocking: true, message: `${name} is flagged as invasive in this state by ALA. Do not plant or release it.`, citationIds: pest.citationIds };
  }
  const intro = lookup(idx.introduced, name);
  const native = lookup(idx.native, name);
  if (intro && native) {
    return { name, verdict: "mixed_records", blocking: false, message: `Warning: ALA has both native and introduced records of ${name} near this site. Check that the plants you buy are local stock (FR-22).`, citationIds: [...new Set([...native.citationIds, ...intro.citationIds])] };
  }
  if (intro) {
    return { name, verdict: "introduced", blocking: true, message: `ALA records show ${name} as introduced near this site. Choose a local native instead.`, citationIds: intro.citationIds };
  }
  if (native) {
    return { name, verdict: "local_native", blocking: false, message: `${name} has native records within the research radius.`, citationIds: native.citationIds };
  }
  return {
    name,
    verdict: "not_recorded_locally",
    blocking: false,
    message: `Warning: no native records of ${name} near this site in the research data. It may not be local. Check with a local nursery or council list before you plant it (FR-22).`,
    citationIds: [],
  };
}

export interface PlanIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  actionId?: string;
}

export interface PlanCheckResult {
  ok: boolean;
  errors: PlanIssue[];
  warnings: PlanIssue[];
  species: SpeciesCheck[];
}

function answerOf(profile: SiteProfile, id: string): string | undefined {
  return profile.answers[id]?.optionIds[0];
}

/** Check a plan against species data, citations and site constraints (FR-22–FR-25). */
export function checkPlan(plan: ActionPlan, research: ResearchReport, profile: SiteProfile, declaredWeeds: DeclaredWeed[]): PlanCheckResult {
  const issues: PlanIssue[] = [];
  const idx = buildSpeciesIndex(research, declaredWeeds, profile.location?.state ?? "NSW");

  // FR-22, FR-24: every planted species, in the list and in actions.
  const names = new Map<string, string | undefined>();
  for (const p of plan.plantingList) names.set(normaliseName(p.scientificName), undefined);
  for (const a of plan.actions) for (const p of a.plantings) if (!names.has(normaliseName(p.scientificName))) names.set(normaliseName(p.scientificName), a.id);
  const species: SpeciesCheck[] = [];
  const original = new Map<string, string>();
  for (const p of [...plan.plantingList, ...plan.actions.flatMap((a) => a.plantings)]) original.set(normaliseName(p.scientificName), p.scientificName.trim());
  for (const [key, actionId] of names) {
    const c = checkSpecies(original.get(key) ?? key, idx);
    species.push(c);
    if (c.blocking) issues.push({ severity: "error", code: c.verdict, message: c.message, ...(actionId ? { actionId } : {}) });
    else if (c.verdict === "not_recorded_locally" || c.verdict === "mixed_records") issues.push({ severity: "warning", code: c.verdict, message: c.message, ...(actionId ? { actionId } : {}) });
  }

  // FR-25: every citation ID must resolve.
  const cited = new Set([...plan.citations.map((c) => c.id), ...research.citations.map((c) => c.id)]);
  for (const a of plan.actions) {
    for (const id of a.citationIds) if (!cited.has(id)) issues.push({ severity: "error", code: "unknown_citation", message: `Action '${a.id}' cites '${id}', which is not in the plan or research citations.`, actionId: a.id });
  }
  for (const p of plan.plantingList) {
    for (const id of p.citationIds) if (!cited.has(id)) issues.push({ severity: "error", code: "unknown_citation", message: `Planting '${p.scientificName}' cites unknown '${id}'.` });
  }
  const ids = new Set(plan.actions.map((a) => a.id));
  for (const q of plan.quickWins) if (!ids.has(q)) issues.push({ severity: "error", code: "unknown_action", message: `Quick win '${q}' is not an action in the plan.` });

  // FR-23: site constraints.
  const tenure = answerOf(profile, "tenure");
  const bushfire = profile.answers.bushfire_prone;
  for (const a of plan.actions) {
    const tags = new Set(a.cautions.map((c) => c.tag));
    if ((tenure === "rent" || tenure === "strata") && a.permanent && !tags.has("renter")) {
      issues.push({ severity: "error", code: "renter_permission", message: `Action '${a.id}' is a permanent change on a ${tenure === "rent" ? "rented" : "strata"} site. Add a 'renter' caution about getting permission, or make it removable.`, actionId: a.id });
    }
    if ((a.category === "planting" || a.category === "habitat_structure") && !tags.has("bushfire")) {
      if (bushfire?.optionIds[0] === "yes") {
        issues.push({ severity: "error", code: "bushfire_caution", message: `The site is on bushfire-prone land. Action '${a.id}' needs a 'bushfire' caution about asset protection zones and plant placement.`, actionId: a.id });
      } else if (bushfire?.notSure) {
        issues.push({ severity: "warning", code: "bushfire_unknown", message: `Bushfire-prone status is not known. Check it before you do action '${a.id}'.`, actionId: a.id });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return { ok: errors.length === 0, errors, warnings, species };
}
