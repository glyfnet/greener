/**
 * Data models for Greener (specification Section 7.1).
 *
 * One Zod schema per data type is the single source of truth: TypeScript
 * types are inferred from it, and tool JSON schemas are generated from it
 * (Section 12.2). This module has no I/O.
 */
import { z } from "zod";

/** Schema version for saved site files. Bump on a breaking change (Section 12.5). */
export const SCHEMA_VERSION = 1;

/** Which knowledge source a citation points to (FR-44). */
export const CitationSource = z.enum(["global_kb", "local_kb", "research", "cost_reference"]);

/** A citation that a plan or answer can point to (FR-25, FR-31, FR-44). */
export const Citation = z.object({
  id: z.string().min(1).describe("Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"),
  source: CitationSource,
  title: z.string().min(1),
  url: z.string().url().optional(),
  publisher: z.string().optional(),
  licence: z.string().optional(),
  accessed: z.string().optional().describe("ISO date the data was retrieved or checked"),
});
export type Citation = z.infer<typeof Citation>;

/** A low–high range. Open-ended upper bounds are not allowed: callers cap them. */
export const Range = z
  .object({ low: z.number().nonnegative(), high: z.number().nonnegative() })
  .refine((r) => r.high >= r.low, { message: "high must be greater than or equal to low" });
export type Range = z.infer<typeof Range>;

/** A missing or failed piece of data, recorded instead of guessing (FR-08, FR-32, NFR-07). */
export const DataGap = z.object({
  topic: z.string().min(1),
  reason: z.string().min(1),
});
export type DataGap = z.infer<typeof DataGap>;

// ---------------------------------------------------------------- species

/** Species tags from FR-11. `biosecurity_pest` is ALA's `stateInvasive` flag. */
export const SpeciesTag = z.enum([
  "native",
  "introduced",
  "threatened",
  "declared_weed",
  "biosecurity_pest",
]);
export type SpeciesTag = z.infer<typeof SpeciesTag>;

export const SpeciesRecord = z.object({
  scientificName: z.string().min(1),
  commonName: z.string().optional(),
  kingdom: z.string().optional(),
  tags: z.array(SpeciesTag),
  recordCount: z.number().int().nonnegative().optional(),
  citationIds: z.array(z.string()).min(1),
});
export type SpeciesRecord = z.infer<typeof SpeciesRecord>;

// ---------------------------------------------------------------- site profile

/** One answer to a question-bank question (Section 7.3, FR-07, FR-08). */
export const Answer = z
  .object({
    optionIds: z.array(z.string()).default([]),
    other: z.string().max(500).optional().describe("Free text from the Other option"),
    notSure: z.boolean().optional(),
  })
  .refine((a) => a.optionIds.length > 0 || a.other !== undefined || a.notSure === true, {
    message: "an answer needs at least one option, an Other text, or notSure",
  });
export type Answer = z.infer<typeof Answer>;

export const Location = z.object({
  lat: z.number().min(-44).max(-10).describe("Latitude, Australia only (D-02)"),
  lon: z.number().min(112).max(154).describe("Longitude, Australia only (D-02)"),
  label: z.string().max(200).optional().describe("Suburb or place name the user gave"),
  precision: z.enum(["exact", "approximate"]).default("approximate"),
  state: z.literal("NSW").default("NSW").describe("MVP covers NSW only (D-02)"),
});
export type Location = z.infer<typeof Location>;

/** Detailed-mode values (FR-10a, FR-60). Each one overrides the simple-mode range. */
export const DetailedAnswers = z.object({
  hoursPerWeekBySeason: z
    .object({
      summer: z.number().min(0).max(80),
      autumn: z.number().min(0).max(80),
      winter: z.number().min(0).max(80),
      spring: z.number().min(0).max(80),
    })
    .optional(),
  upfrontBudgetAud: z.number().nonnegative().optional(),
  yearlyBudgetAud: z.number().nonnegative().optional(),
  areaM2: z.number().positive().optional(),
});
export type DetailedAnswers = z.infer<typeof DetailedAnswers>;

/** A user's local price that replaces a cost-reference row (FR-69). */
export const LocalPrice = z.object({
  item: z.string().min(1),
  unit: z.string().min(1),
  lowAud: z.number().nonnegative(),
  highAud: z.number().nonnegative(),
  asOf: z.string().min(1),
  note: z.string().optional(),
});
export type LocalPrice = z.infer<typeof LocalPrice>;

export const SiteProfile = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  mode: z.enum(["simple", "detailed"]).default("simple"),
  location: Location.optional(),
  answers: z.record(z.string(), Answer).default({}),
  detailed: DetailedAnswers.optional(),
  localPrices: z.array(LocalPrice).default([]),
  dataGaps: z.array(DataGap).default([]),
});
export type SiteProfile = z.infer<typeof SiteProfile>;

// ---------------------------------------------------------------- research

export const ResearchReport = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  createdAt: z.string().min(1),
  radiusKm: z.number().positive().max(50),
  keyNativePlants: z.array(SpeciesRecord),
  keyFauna: z.array(SpeciesRecord),
  threatenedSpecies: z.array(SpeciesRecord),
  invasiveSpecies: z.array(SpeciesRecord),
  climateSummary: z.string().optional(),
  soilSummary: z.string().optional(),
  vegetationCommunity: z.string().optional(),
  dataGaps: z.array(DataGap),
  citations: z.array(Citation).min(1),
});
export type ResearchReport = z.infer<typeof ResearchReport>;

// ---------------------------------------------------------------- plan

export const ActionCategory = z.enum([
  "weed_control",
  "soil",
  "planting",
  "water",
  "habitat_structure",
  "pest_animal",
  "monitoring",
  "other",
]);
export const Priority = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof Priority>;

/** Structured caution, so constraint checks can run in code (FR-23, rule 6). */
export const Caution = z.object({
  tag: z.enum(["bushfire", "renter", "council", "pets", "safety", "other"]),
  text: z.string().min(1),
});

/** Calendar months 1–12. A window may wrap the year end (e.g. 11 → 2). */
export const Month = z.number().int().min(1).max(12);

export const Planting = z.object({
  scientificName: z.string().min(1),
  commonName: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  citationIds: z.array(z.string()).min(1),
});
export type Planting = z.infer<typeof Planting>;

/** One action in a plan (FR-21, FR-61, FR-62). */
export const Action = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1),
  category: ActionCategory,
  priority: Priority,
  effort: z.enum(["low", "medium", "high"]),
  season: z.array(z.enum(["summer", "autumn", "winter", "spring"])).min(1),
  steps: z.array(z.string().min(1)).min(1),
  targetSpecies: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  cautions: z.array(Caution).default([]),
  citationIds: z.array(z.string()).min(1, "each action must cite at least one source (FR-25)"),
  labourHours: Range,
  materialsAud: Range.nullable().describe("null when there is no cost data (FR-70)"),
  costAsOf: z.string().optional().describe("Date of the cost reference used (FR-68)"),
  window: z.object({ startMonth: Month, endMonth: Month }),
  dependsOn: z.array(z.string()).default([]),
  maintenanceHoursPerMonth: z.number().nonnegative().default(0),
  benefit: z.number().int().min(1).max(5).default(3).describe("Relative benefit, used to rank by benefit per hour"),
  permanent: z.boolean().default(false).describe("True for fixed works a renter may need permission for"),
  plantings: z.array(Planting).default([]),
  done: z
    .object({ month: z.number().int().min(1).max(36), hours: z.number().nonnegative(), costAud: z.number().nonnegative() })
    .optional()
    .describe("Set by mark_done (FR-71): month index in the plan and actual effort"),
});
export type Action = z.infer<typeof Action>;
export type ActionInput = z.input<typeof Action>;

export const ActionPlan = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  version: z.number().int().positive(),
  createdAt: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  quickWins: z.array(z.string()).default([]).describe("Action IDs"),
  actions: z.array(Action).min(1),
  plantingList: z.array(Planting).default([]),
  monitoring: z.array(z.string().min(1)).min(1),
  localResources: z.array(z.object({ title: z.string(), url: z.string().url().optional(), citationId: z.string() })).default([]),
  citations: z.array(Citation).min(1),
});
export type ActionPlan = z.infer<typeof ActionPlan>;

// ---------------------------------------------------------------- cost reference

/** One row of `data/cost-reference.csv` (Section 7.7). */
export const CostRow = z.object({
  item: z.string().min(1),
  unit: z.string().min(1),
  lowAud: z.number().nonnegative(),
  highAud: z.number().nonnegative(),
  region: z.string().min(1),
  source: z.string().min(1),
  asOf: z.string().min(1),
});
export type CostRow = z.infer<typeof CostRow>;
