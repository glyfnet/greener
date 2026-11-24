/**
 * Native, weed and constraint checks (FR-22–FR-25, NFR-03).
 *
 * These rules must never fail silently, so they live in tested code, not in
 * skills (rule 6). `save_plan` runs `checkPlan` and refuses the plan when it
 * returns any error.
 */
import type { ActionPlan, ResearchReport, SiteProfile, SpeciesRecord } from "./models.js";

export type SpeciesVerdict = "local_native" | "mixed_records" | "related_declared" | "not_recorded_locally" | "introduced" | "declared_weed" | "biosecurity_pest";

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
  /** Genera declared as a whole ("Cortaderia species"). */
  declaredGenera: Map<string, DeclaredWeed>;
  /** Binomials of declared infraspecific taxa (e.g. Olea europaea for African olive). */
  declaredRelated: Map<string, DeclaredWeed>;
}

/** KB item that documents the declared weed list (see data/README.md). */
export const DECLARED_WEEDS_CITATION = "kb:nsw-weedwise-greater-sydney";

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

export function buildSpeciesIndex(research: Pick<ResearchReport, "keyNativePlants" | "keyFauna" | "threatenedSpecies" | "invasiveSpecies">, declaredWeeds: DeclaredWeed[], state = "NSW", extraNatives: SpeciesRecord[] = []): SpeciesIndex {
  const idx: SpeciesIndex = { native: new Map(), introduced: new Map(), biosecurity: new Map(), declared: new Map(), declaredGenera: new Map(), declaredRelated: new Map() };
  // extraNatives: species confirmed native near the site by a live ALA query (D-17).
  const all = [...research.keyNativePlants, ...research.keyFauna, ...research.threatenedSpecies, ...research.invasiveSpecies, ...extraNatives];
  for (const r of all) {
    const key = normaliseName(r.scientificName);
    if (r.tags.includes("native")) idx.native.set(key, r);
    if (r.tags.includes("introduced")) idx.introduced.set(key, r);
    if (r.tags.includes("biosecurity_pest")) idx.biosecurity.set(key, r);
  }
  for (const w of declaredWeeds) {
    if (w.state !== state) continue;
    const key = normaliseName(w.scientificName);
    const parts = key.split(" ");
    if (parts.length === 2 && parts[1] === "species") idx.declaredGenera.set(parts[0] ?? key, w);
    else {
      idx.declared.set(key, w);
      if (parts.length > 2) idx.declaredRelated.set(parts.slice(0, 2).join(" "), w);
    }
  }
  return idx;
}

/**
 * Check one species for planting. Weed and pest checks run first and win over
 * any native record, so a declared weed is always blocked (FR-24, NFR-03).
 */
export function checkSpecies(name: string, idx: SpeciesIndex): SpeciesCheck {
  const declared = lookup(idx.declared, name) ?? idx.declaredGenera.get(normaliseName(name).split(" ")[0] ?? "");
  if (declared) {
    return { name, verdict: "declared_weed", blocking: true, message: `${name} is a priority weed in ${declared.state} (${declared.category}; ${declared.sourceUrl}). Do not plant it.`, citationIds: [DECLARED_WEEDS_CITATION] };
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
  const related = idx.declaredRelated.get(normaliseName(name));
  if (related && !native) {
    return { name, verdict: "related_declared", blocking: true, message: `${related.scientificName} is a priority weed (${related.sourceUrl}), and there are no native records of ${name} near this site. Do not plant it (D-17).`, citationIds: [DECLARED_WEEDS_CITATION] };
  }
  if (related) {
    return { name, verdict: "related_declared", blocking: false, message: `Warning: ${related.scientificName} is a priority weed (${related.sourceUrl}). Make sure ${name} is not that form before you plant it.`, citationIds: [DECLARED_WEEDS_CITATION, ...(native?.citationIds ?? [])] };
  }
  if (native) {
    return { name, verdict: "local_native", blocking: false, message: `${name} has native records within the research radius.`, citationIds: native.citationIds };
  }
  // D-17: local natives only. No native record near the site means no planting.
  return {
    name,
    verdict: "not_recorded_locally",
    blocking: true,
    message: `No native records of ${name} near this site. Greener plants local natives only (D-17). Choose a species from the research report, or check this one with check_species.`,
    citationIds: [],
  };
}

/**
 * Chemical methods that a rewilding plan must not use (D-17). Matched as
 * whole words, case-insensitive. Product names are not listed: the generic
 * words catch the methods, and a product name would be an invented list.
 */
export const CHEMICAL_TERMS = [
  "herbicide", "herbicides", "pesticide", "pesticides", "insecticide", "insecticides", "fungicide", "fungicides",
  "rodenticide", "rodenticides", "molluscicide", "glyphosate", "weedkiller", "weed killer", "poison", "poisons", "poisoned",
  "bait", "baits", "baiting", "1080", "snail pellets", "slug pellets", "spray", "sprays", "spraying", "spot spray",
  "cut and paint", "gouge and paint", "scrape and paint", "stem injection", "basal bark", "chemical", "chemicals",
  "synthetic fertiliser", "synthetic fertilizer",
];

const NEGATION = /\b(no|not|never|without|avoid|avoiding|instead of|don't|do not|free of|chemical-free|stop|stopping|phase out|rather than)\b[^.;:]{0,40}$/i;

/** Chemical terms used as a method in this text. Mentions after a negation ("do not spray") are allowed. */
export function chemicalUses(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const term of CHEMICAL_TERMS) {
    const re = new RegExp(`(?<![a-z0-9-])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9-])`, "g");
    for (const m of lower.matchAll(re)) {
      const before = lower.slice(Math.max(0, (m.index ?? 0) - 60), m.index);
      if (!NEGATION.test(before)) found.add(term);
    }
  }
  return [...found];
}

export interface PlanIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  actionId?: string;
  /** Site strategy (get_site_strategies) that explains how to fix it. */
  strategyId?: string;
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
export function checkPlan(plan: ActionPlan, research: ResearchReport, profile: SiteProfile, declaredWeeds: DeclaredWeed[], extraNatives: SpeciesRecord[] = []): PlanCheckResult {
  const issues: PlanIssue[] = [];
  const idx = buildSpeciesIndex(research, declaredWeeds, profile.location?.state ?? "NSW", extraNatives);

  // D-17: no chemicals in any action's title or steps.
  for (const a of plan.actions) {
    const used = chemicalUses([a.title, ...a.steps].join(". "));
    if (used.length) issues.push({ severity: "error", code: "uses_chemicals", message: `Action '${a.id}' uses chemicals (${used.join(", ")}). Greener plans are chemical-free (D-17): use hand removal, smothering, exclusion or revegetation instead.`, actionId: a.id, strategyId: "chemical_free" });
  }

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
    else if (c.verdict === "not_recorded_locally" || c.verdict === "mixed_records" || c.verdict === "related_declared") issues.push({ severity: "warning", code: c.verdict, message: c.message, ...(actionId ? { actionId } : {}) });
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

  // FR-23: site constraints. These sites are accepted; missing cautions are
  // warnings that point to the site strategy, so Claude can fix the plan.
  const tenure = answerOf(profile, "tenure");
  const site = answerOf(profile, "site_type");
  const bushfire = profile.answers.bushfire_prone;
  const smallSite = site === "apartment" || site === "townhouse";
  for (const a of plan.actions) {
    const tags = new Set(a.cautions.map((c) => c.tag));
    if ((tenure === "rent" || tenure === "strata") && a.permanent && !tags.has("renter")) {
      issues.push({ severity: "warning", code: "renter_permission", message: `Action '${a.id}' is a permanent change on a ${tenure === "rent" ? "rented" : "strata"} site. Add a 'renter' caution about getting permission, or make it removable.`, actionId: a.id, strategyId: "removable" });
    } else if (smallSite && a.permanent && !tags.has("renter") && !tags.has("council")) {
      issues.push({ severity: "warning", code: "strata_permission", message: `Action '${a.id}' fixes something to the building. Check strata by-laws or the owner's approval, and add a 'renter' caution.`, actionId: a.id, strategyId: "small_space" });
    }
    if (smallSite && (a.category === "water" || a.category === "habitat_structure") && !tags.has("safety")) {
      issues.push({ severity: "warning", code: "small_space_safety", message: `Action '${a.id}' adds weight or a fixture in a small space. Add a 'safety' caution about load, drainage and wind.`, actionId: a.id, strategyId: "small_space" });
    }
    if ((a.category === "planting" || a.category === "habitat_structure") && !tags.has("bushfire")) {
      if (bushfire?.optionIds[0] === "yes") {
        issues.push({ severity: "warning", code: "bushfire_caution", message: `The site is on bushfire-prone land. Add a 'bushfire' caution to action '${a.id}' that says where it goes relative to the house and asset protection zone.`, actionId: a.id, strategyId: "bushfire" });
      } else if (bushfire?.notSure) {
        issues.push({ severity: "warning", code: "bushfire_unknown", message: `Bushfire-prone status is not known. Check it before you do action '${a.id}'.`, actionId: a.id, strategyId: "bushfire_unknown" });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return { ok: errors.length === 0, errors, warnings, species };
}
