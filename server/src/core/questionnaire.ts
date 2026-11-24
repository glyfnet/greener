/**
 * Question bank, skip logic and answer handling (Section 7.3, FR-01–FR-10b).
 *
 * Pure functions: the bank is passed in, so tests and the Worker share one
 * code path. The bank itself lives in `data/question-bank.yaml`.
 */
import { z } from "zod";
import { Answer, type SiteProfile } from "./models.js";

const ShowWhen = z
  .object({
    siteTypeNot: z.array(z.string()).optional(),
    siteTypeIn: z.array(z.string()).optional(),
  })
  .strict();
type ShowWhen = z.infer<typeof ShowWhen>;

export const QuestionOption = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    icon: z.string().optional(),
    range: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).optional(),
    showWhen: ShowWhen.optional(),
  })
  .strict();
export type QuestionOption = z.infer<typeof QuestionOption>;

export const Question = z
  .object({
    id: z.string().regex(/^[a-z_]+$/),
    number: z.number().int().positive(),
    text: z.string().min(1),
    kind: z.enum(["choice", "location"]).default("choice"),
    select: z.enum(["one", "many", "upTo3"]),
    unit: z.enum(["m2", "hours_per_week", "aud"]).optional(),
    notSure: z.boolean().default(false),
    notSureNote: z.string().optional(),
    showWhen: ShowWhen.optional(),
    options: z.array(QuestionOption).min(2).max(6),
  })
  .strict();
export type Question = z.infer<typeof Question>;

export const QuestionBank = z
  .object({ questions: z.array(Question).min(1) })
  .superRefine((bank, ctx) => {
    const ids = new Set<string>();
    for (const q of bank.questions) {
      if (ids.has(q.id)) ctx.addIssue({ code: "custom", message: `duplicate question id ${q.id}` });
      ids.add(q.id);
      const optIds = new Set(q.options.map((o) => o.id));
      if (optIds.size !== q.options.length) ctx.addIssue({ code: "custom", message: `duplicate option id in ${q.id}` });
    }
  });
export type QuestionBank = z.infer<typeof QuestionBank>;

/** The `site_type` question drives skip logic (FR-10b). */
export const SITE_TYPE_QUESTION = "site_type";

function siteTypeOf(answers: SiteProfile["answers"]): string | undefined {
  return answers[SITE_TYPE_QUESTION]?.optionIds[0];
}

function passes(rule: ShowWhen | undefined, siteType: string | undefined): boolean {
  if (!rule) return true;
  // Until the site type is known, show everything: we can't rule anything out.
  if (siteType === undefined) return true;
  if (rule.siteTypeNot?.includes(siteType)) return false;
  if (rule.siteTypeIn && !rule.siteTypeIn.includes(siteType)) return false;
  return true;
}

/** Questions that apply to this site, in order, with options filtered (FR-10b). */
export function visibleQuestions(bank: QuestionBank, answers: SiteProfile["answers"]): Question[] {
  const siteType = siteTypeOf(answers);
  return bank.questions
    .filter((q) => passes(q.showWhen, siteType))
    .map((q) => ({ ...q, options: q.options.filter((o) => passes(o.showWhen, siteType)) }))
    .sort((a, b) => a.number - b.number);
}

export interface Progress {
  /** 1-based position of this question among visible questions. */
  index: number;
  total: number;
}

/** The first visible question without an answer (and not skipped), or undefined when none is left. */
export function nextQuestion(
  bank: QuestionBank,
  answers: SiteProfile["answers"],
  skipIds: readonly string[] = [],
): { question: Question; progress: Progress } | undefined {
  const visible = visibleQuestions(bank, answers);
  const i = visible.findIndex((q) => answers[q.id] === undefined && !skipIds.includes(q.id));
  if (i < 0) return undefined;
  const question = visible[i];
  return question ? { question, progress: { index: i + 1, total: visible.length } } : undefined;
}

export function findQuestion(bank: QuestionBank, answers: SiteProfile["answers"], id: string): Question | undefined {
  return visibleQuestions(bank, answers).find((q) => q.id === id);
}

/** Check an answer against its question. Returns plain-English errors (Section 12.2). */
export function validateAnswer(question: Question, raw: unknown): { ok: true; answer: Answer } | { ok: false; errors: string[] } {
  const parsed = Answer.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const answer = parsed.data;
  const errors: string[] = [];
  const valid = new Set(question.options.map((o) => o.id));
  for (const id of answer.optionIds) {
    if (!valid.has(id)) errors.push(`'${id}' is not an option for ${question.id}. Valid options: ${[...valid].join(", ")}`);
  }
  if (answer.notSure && !question.notSure) errors.push(`${question.id} has no Not sure option`);
  const max = question.select === "one" ? 1 : question.select === "upTo3" ? 3 : question.options.length;
  if (answer.optionIds.length > max) errors.push(`${question.id} accepts at most ${max} option(s)`);
  if (new Set(answer.optionIds).size !== answer.optionIds.length) errors.push("an option is repeated");
  return errors.length ? { ok: false, errors } : { ok: true, answer };
}

/**
 * Set one answer and drop answers that skip logic now hides (FR-06, FR-10b).
 * Returns a new profile; the input is not changed.
 */
export function applyAnswer(bank: QuestionBank, profile: SiteProfile, questionId: string, answer: Answer): SiteProfile {
  const answers = { ...profile.answers, [questionId]: answer };
  const visible = visibleQuestions(bank, answers);
  const visibleIds = new Set(visible.map((q) => q.id));
  const kept: SiteProfile["answers"] = {};
  for (const [id, a] of Object.entries(answers)) {
    if (!visibleIds.has(id)) continue;
    const q = visible.find((v) => v.id === id);
    const allowed = new Set(q?.options.map((o) => o.id));
    kept[id] = { ...a, optionIds: a.optionIds.filter((o) => allowed.has(o)) };
  }
  const gaps = profile.dataGaps.filter((g) => g.topic !== questionId);
  if (answer.notSure) gaps.push({ topic: questionId, reason: "User was not sure; fill from data or keep as a data gap (FR-08)." });
  return { ...profile, answers: kept, dataGaps: gaps };
}

/** Numbered text form of a question for hosts without MCP Apps (FR-09). */
export function renderQuestionText(question: Question, progress: Progress): { text: string; choices: string[] } {
  const choices = question.options.map((o) => o.label);
  if (question.notSure) choices.push(question.notSureNote ? `Not sure (${question.notSureNote.replace(/\.$/, "").toLowerCase()})` : "Not sure");
  choices.push("Other (type an answer)");
  const hint =
    question.select === "one" ? "Reply with one number." : question.select === "upTo3" ? "Reply with up to 3 numbers, e.g. 1, 3." : "Reply with one or more numbers, e.g. 1, 3.";
  const lines = [`Question ${progress.index} of ${progress.total}: ${question.text}`, ...choices.map((c, i) => `${i + 1}. ${c}`), hint];
  return { text: lines.join("\n"), choices };
}

/**
 * Turn a numbered reply ("1, 3") into an answer (FR-09). `otherText` is used
 * when the user picks the Other number.
 */
export function parseNumberedReply(question: Question, reply: string, otherText?: string): { ok: true; answer: Answer } | { ok: false; errors: string[] } {
  const nums = reply.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length === 0 || nums.some((n) => !Number.isInteger(n))) return { ok: false, errors: ["Reply with option numbers, e.g. 2 or 1, 3"] };
  const notSureNo = question.notSure ? question.options.length + 1 : -1;
  const otherNo = question.options.length + (question.notSure ? 2 : 1);
  const optionIds: string[] = [];
  let notSure = false;
  let other: string | undefined;
  for (const n of nums) {
    if (n === notSureNo) notSure = true;
    else if (n === otherNo) other = otherText ?? "";
    else {
      const opt = question.options[n - 1];
      if (!opt) return { ok: false, errors: [`${n} is not a choice. Pick 1 to ${otherNo}.`] };
      optionIds.push(opt.id);
    }
  }
  if (other === "") return { ok: false, errors: ["Other needs a short text answer"] };
  return validateAnswer(question, { optionIds, notSure: notSure || undefined, other });
}

// ---------------------------------------------------------------- capacity (FR-60)

export type Season = "summer" | "autumn" | "winter" | "spring";
export const SEASONS: readonly Season[] = ["summer", "autumn", "winter", "spring"];

/**
 * Default seasonal profile for a single weekly value: less in summer heat
 * (Section 7.3). TODO(Q-15): the 0.75 summer factor is an assumption; test it
 * with pilot users.
 */
export const DEFAULT_SEASONAL_FACTORS: Record<Season, number> = { summer: 0.75, autumn: 1, winter: 1, spring: 1 };

export interface Capacity {
  hoursPerWeek: Record<Season, number>;
  upfrontAud: number;
  yearlyAud: number;
  paidHelp: "none" | "family" | "sometimes" | "contractor" | "unknown";
}

function optionRange(bank: QuestionBank, questionId: string, answers: SiteProfile["answers"]): [number, number] | undefined {
  const optId = answers[questionId]?.optionIds[0];
  const q = bank.questions.find((x) => x.id === questionId);
  return q?.options.find((o) => o.id === optId)?.range;
}

/**
 * Capacity inputs for `schedule_plan`. Simple mode uses the high end of each
 * range for capacity checks (Section 7.3); detailed values override it.
 * Missing answers give zero capacity and a data gap, never a guess.
 */
export function capacityFromProfile(bank: QuestionBank, profile: SiteProfile): { capacity: Capacity; gaps: string[] } {
  const gaps: string[] = [];
  const hours = optionRange(bank, "hours_per_week", profile.answers);
  const upfront = optionRange(bank, "upfront_budget", profile.answers);
  const yearly = optionRange(bank, "yearly_budget", profile.answers);
  const d = profile.detailed;
  let hoursPerWeek: Record<Season, number>;
  if (d?.hoursPerWeekBySeason) hoursPerWeek = d.hoursPerWeekBySeason;
  else {
    if (!hours) gaps.push("hours_per_week");
    const h = hours?.[1] ?? 0;
    hoursPerWeek = { summer: h * DEFAULT_SEASONAL_FACTORS.summer, autumn: h, winter: h, spring: h };
  }
  const upfrontAud = d?.upfrontBudgetAud ?? upfront?.[1] ?? 0;
  const yearlyAud = d?.yearlyBudgetAud ?? yearly?.[1] ?? 0;
  if (d?.upfrontBudgetAud === undefined && !upfront) gaps.push("upfront_budget");
  if (d?.yearlyBudgetAud === undefined && !yearly) gaps.push("yearly_budget");
  const help = profile.answers.help?.optionIds[0];
  const paidHelp: Capacity["paidHelp"] =
    help === "just_me" ? "none" : help === "family_friends" ? "family" : help === "paid_sometimes" ? "sometimes" : help === "contractor" ? "contractor" : "unknown";
  return { capacity: { hoursPerWeek, upfrontAud, yearlyAud, paidHelp }, gaps };
}

/** Middle of a range, used for calculations other than capacity (Section 7.3). */
export function midpoint(range: readonly [number, number]): number {
  return (range[0] + range[1]) / 2;
}
