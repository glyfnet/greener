/**
 * Budget and phasing engine (Section 7.7, FR-61–FR-67, FR-71).
 *
 * Phasing is exact work, so it lives here and not in a prompt (rule 6).
 * Pure and deterministic: the same input always gives the same schedule.
 */
import { z } from "zod";
import { Action, type ActionInput, type Priority } from "./models.js";
import { SEASONS, type Season } from "./questionnaire.js";

/** Months in the plan horizon (Section 7.7). TODO(Q-13): confirm 36 months for small backyards. */
export const HORIZON_MONTHS = 36;
/** Average weeks per month used in the capacity formula. */
export const WEEKS_PER_MONTH = 4.33;
/** Default utilisation factor u. TODO: an assumption to test with real users (Section 7.7). */
export const DEFAULT_UTILISATION = 0.8;

export const ScheduleCapacity = z.object({
  hoursPerWeek: z.object({
    summer: z.number().min(0).max(80),
    autumn: z.number().min(0).max(80),
    winter: z.number().min(0).max(80),
    spring: z.number().min(0).max(80),
  }),
  upfrontAud: z.number().nonnegative(),
  yearlyAud: z.number().nonnegative(),
});
export type ScheduleCapacity = z.infer<typeof ScheduleCapacity>;

export const ScheduleInput = z.object({
  actions: z.array(Action).min(1).max(200),
  capacity: ScheduleCapacity,
  startMonth: z.number().int().min(1).max(12).describe("Calendar month the plan starts (1 = January)"),
  utilisation: z.number().gt(0).max(1).default(DEFAULT_UTILISATION),
});
export type ScheduleInput = z.infer<typeof ScheduleInput>;

export type PhaseId = 0 | 1 | 2 | 3;
export const PHASE_NAMES: Record<PhaseId, string> = {
  0: "Quick wins",
  1: "Prepare and establish",
  2: "Expand",
  3: "Mature and monitor",
};

export type DeferReason = "time" | "money" | "season" | "dependency";

export interface ScheduledAction {
  actionId: string;
  month: number;
  calendarMonth: number;
  phase: PhaseId;
  labourHoursHigh: number;
  costAud: { low: number; high: number } | null;
  done: boolean;
}

export interface DeferredAction {
  actionId: string;
  reason: DeferReason;
  detail: string;
  extraHoursPerWeek?: number;
  extraAud?: number;
}

export interface MonthRow {
  month: number;
  calendarMonth: number;
  capacityHours: number;
  maintenanceHours: number;
  workHours: number;
  freeHours: number;
  costHighAud: number;
}

export interface MoneyRow {
  label: string;
  lowAud: number;
  highAud: number;
}

export interface ScheduleResult {
  scheduled: ScheduledAction[];
  phases: { phase: PhaseId; name: string; months: string; actionIds: string[]; hoursHigh: number; costLowAud: number; costHighAud: number }[];
  monthly: MonthRow[];
  budgetTable: { byPhase: MoneyRow[]; byYear: (MoneyRow & { budgetAud: number })[]; runningTotal: MoneyRow[] };
  deferred: DeferredAction[];
  costUnknown: string[];
  whatMoreWouldAdd?: { extraHoursPerWeek: number; extraBudgetPercent: number; movedForward: { actionId: string; from: string; to: string }[]; summary: string };
  notes: string[];
}

export class ScheduleError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
  }
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Southern-hemisphere season for a calendar month (1–12). */
export function seasonOf(calendarMonth: number): Season {
  if (calendarMonth === 12 || calendarMonth <= 2) return "summer";
  if (calendarMonth <= 5) return "autumn";
  if (calendarMonth <= 8) return "winter";
  return "spring";
}

/** True when a calendar month is inside a work window; windows may wrap the year end. */
export function inWindow(calendarMonth: number, window: { startMonth: number; endMonth: number }): boolean {
  const { startMonth: s, endMonth: e } = window;
  return s <= e ? calendarMonth >= s && calendarMonth <= e : calendarMonth >= s || calendarMonth <= e;
}

export function calendarMonthOf(planMonth: number, startMonth: number): number {
  return ((startMonth - 1 + planMonth - 1) % 12) + 1;
}

export function phaseOfMonth(month: number): Exclude<PhaseId, 0> {
  if (month <= 6) return 1;
  if (month <= 18) return 2;
  return 3;
}

const PHASE_MONTHS: Record<PhaseId, string> = { 0: "Month 1", 1: "Months 1–6", 2: "Months 7–18", 3: "Months 19–36" };

/** Gross capacity C_m before maintenance: h × 4.33 × u (Section 7.7). */
function grossCapacity(input: ScheduleInput, planMonth: number): number {
  const season = seasonOf(calendarMonthOf(planMonth, input.startMonth));
  return input.capacity.hoursPerWeek[season] * WEEKS_PER_MONTH * input.utilisation;
}

/** Budget available up to and including a plan month: upfront plus each year's budget after year 1. */
function cumulativeBudget(input: ScheduleInput, planMonth: number): number {
  return input.capacity.upfrontAud + input.capacity.yearlyAud * Math.floor((planMonth - 1) / 12);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function validate(actions: Action[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const a of actions) {
    if (ids.has(a.id)) errors.push(`duplicate action id '${a.id}'`);
    ids.add(a.id);
  }
  for (const a of actions) {
    for (const d of a.dependsOn) {
      if (!ids.has(d)) errors.push(`action '${a.id}' depends on unknown action '${d}'`);
      if (d === a.id) errors.push(`action '${a.id}' depends on itself`);
    }
  }
  return errors;
}

/** Dependency level of each action. Throws on a cycle. */
function levels(actions: Action[]): Map<string, number> {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const known = level.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) throw new ScheduleError([`dependency cycle through action '${id}'`]);
    visiting.add(id);
    const a = byId.get(id);
    const l = a && a.dependsOn.length ? 1 + Math.max(...a.dependsOn.map(visit)) : 0;
    visiting.delete(id);
    level.set(id, l);
    return l;
  };
  actions.forEach((a) => visit(a.id));
  return level;
}

function costHigh(a: Action): number {
  return a.done ? a.done.costAud : (a.materialsAud?.high ?? 0);
}

/** Schedule actions into phases. Throws ScheduleError on invalid input. */
export function schedulePlan(rawInput: z.input<typeof ScheduleInput>, opts: { explore?: boolean } = { explore: true }): ScheduleResult {
  const input = ScheduleInput.parse(rawInput);
  const errors = validate(input.actions);
  if (errors.length) throw new ScheduleError(errors);
  const level = levels(input.actions);

  const H = HORIZON_MONTHS;
  const work = new Array<number>(H + 1).fill(0);
  const maint = new Array<number>(H + 1).fill(0);
  const spend = new Array<number>(H + 1).fill(0);
  const cap = Array.from({ length: H + 1 }, (_, m) => (m === 0 ? 0 : grossCapacity(input, m)));
  const placed = new Map<string, number>();
  const scheduled: ScheduledAction[] = [];
  const deferred: DeferredAction[] = [];

  const addMaintenance = (fromMonth: number, hours: number) => {
    for (let k = fromMonth + 1; k <= H; k++) maint[k] = (maint[k] ?? 0) + hours;
  };
  const record = (a: Action, month: number, labour: number, done: boolean) => {
    const cost = a.done ? { low: a.done.costAud, high: a.done.costAud } : a.materialsAud ? { low: a.materialsAud.low, high: a.materialsAud.high } : null;
    const quick = month === 1 && labour <= 4 && (cost?.high ?? 0) <= 0.1 * input.capacity.upfrontAud;
    scheduled.push({ actionId: a.id, month, calendarMonth: calendarMonthOf(month, input.startMonth), phase: quick ? 0 : phaseOfMonth(month), labourHoursHigh: labour, costAud: cost, done });
    placed.set(a.id, month);
  };

  // Done actions are fixed at their month with actual effort (FR-71).
  for (const a of input.actions) {
    if (!a.done) continue;
    work[a.done.month] = (work[a.done.month] ?? 0) + a.done.hours;
    spend[a.done.month] = (spend[a.done.month] ?? 0) + a.done.costAud;
    addMaintenance(a.done.month, a.maintenanceHoursPerMonth);
    record(a, a.done.month, a.done.hours, true);
  }

  // Step 1–2: dependency order, then priority, then benefit per hour.
  const todo = input.actions
    .filter((a) => !a.done)
    .sort(
      (a, b) =>
        (level.get(a.id) ?? 0) - (level.get(b.id) ?? 0) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.benefit / Math.max(b.labourHours.high, 0.1) - a.benefit / Math.max(a.labourHours.high, 0.1) ||
        a.id.localeCompare(b.id),
    );

  const deferredIds = new Set<string>();
  for (const a of todo) {
    const blocked = a.dependsOn.filter((d) => deferredIds.has(d));
    if (blocked.length) {
      deferredIds.add(a.id);
      deferred.push({ actionId: a.id, reason: "dependency", detail: `Waits for deferred action(s): ${blocked.join(", ")}` });
      continue;
    }
    // A dependency must finish in an earlier month.
    const earliest = Math.max(1, ...a.dependsOn.map((d) => (placed.get(d) ?? 0) + 1));
    const labour = a.labourHours.high; // Step 4: schedule with the high estimate.
    const cost = costHigh(a);
    let inWindowMonths = 0;
    let timeFails = 0;
    let moneyFails = 0;
    let chosen: number | undefined;
    for (let m = earliest; m <= H; m++) {
      if (!inWindow(calendarMonthOf(m, input.startMonth), a.window)) continue;
      inWindowMonths++;
      const free = (cap[m] ?? 0) - (work[m] ?? 0) - (maint[m] ?? 0);
      let fitsTime = labour <= free + 1e-9;
      // New maintenance must still fit in every later month (FR-63, FR-64).
      for (let k = m + 1; fitsTime && k <= H; k++) {
        if ((work[k] ?? 0) + (maint[k] ?? 0) + a.maintenanceHoursPerMonth > (cap[k] ?? 0) + 1e-9) fitsTime = false;
      }
      let fitsMoney = true;
      let cum = 0;
      for (let k = 1; k <= H; k++) {
        cum += spend[k] ?? 0;
        if (k >= m && cum + cost > cumulativeBudget(input, k) + 1e-9) {
          fitsMoney = false;
          break;
        }
      }
      if (!fitsTime) timeFails++;
      if (!fitsMoney) moneyFails++;
      if (fitsTime && fitsMoney) {
        chosen = m;
        break;
      }
    }
    if (chosen !== undefined) {
      work[chosen] = (work[chosen] ?? 0) + labour;
      spend[chosen] = (spend[chosen] ?? 0) + cost;
      addMaintenance(chosen, a.maintenanceHoursPerMonth);
      record(a, chosen, labour, false);
    } else {
      deferredIds.add(a.id);
      deferred.push(deferReason(input, a, inWindowMonths, timeFails, moneyFails, earliest));
    }
  }

  scheduled.sort((x, y) => x.month - y.month || x.actionId.localeCompare(y.actionId));
  const result = summarise(input, scheduled, deferred, work, maint, spend, cap);
  if (opts.explore !== false) result.whatMoreWouldAdd = exploreMore(input, result);
  return result;
}

function deferReason(input: ScheduleInput, a: Action, inWindowMonths: number, timeFails: number, moneyFails: number, earliest: number): DeferredAction {
  if (inWindowMonths === 0) {
    return { actionId: a.id, reason: "season", detail: `No month in its work window (${a.window.startMonth}–${a.window.endMonth}) is left in the 36-month plan after month ${earliest - 1}.` };
  }
  const maxGross = Math.max(...Array.from({ length: HORIZON_MONTHS }, (_, i) => (inWindow(calendarMonthOf(i + 1, input.startMonth), a.window) ? grossCapacity(input, i + 1) : 0)));
  const totalBudget = cumulativeBudget(input, HORIZON_MONTHS);
  const cost = costHigh(a);
  if (a.labourHours.high > maxGross + 1e-9 || (timeFails >= moneyFails && timeFails > 0)) {
    const shortfall = Math.max(0, a.labourHours.high - maxGross);
    const extra = shortfall > 0 ? round(shortfall / (WEEKS_PER_MONTH * input.utilisation)) : undefined;
    return {
      actionId: a.id,
      reason: "time",
      detail: shortfall > 0 ? `Needs up to ${a.labourHours.high} h in one month, but at most ${round(maxGross)} h is available. Split it into smaller steps, or add time.` : "Not enough free hours in any month of its work window after other actions and maintenance.",
      ...(extra !== undefined ? { extraHoursPerWeek: extra } : {}),
    };
  }
  return {
    actionId: a.id,
    reason: "money",
    detail: cost > totalBudget ? `Costs up to $${cost}, more than the total budget of $${totalBudget} over 36 months.` : "Not enough budget left when its work window comes around.",
    ...(cost > totalBudget ? { extraAud: round(cost - totalBudget) } : {}),
  };
}

function summarise(input: ScheduleInput, scheduled: ScheduledAction[], deferred: DeferredAction[], work: number[], maint: number[], spend: number[], cap: number[]): ScheduleResult {
  const phases = ([0, 1, 2, 3] as PhaseId[]).map((p) => {
    const items = scheduled.filter((s) => s.phase === p);
    return {
      phase: p,
      name: PHASE_NAMES[p],
      months: PHASE_MONTHS[p],
      actionIds: items.map((s) => s.actionId),
      hoursHigh: round(items.reduce((t, s) => t + s.labourHoursHigh, 0)),
      costLowAud: round(items.reduce((t, s) => t + (s.costAud?.low ?? 0), 0)),
      costHighAud: round(items.reduce((t, s) => t + (s.costAud?.high ?? 0), 0)),
    };
  });
  const byYear = [1, 2, 3].map((y) => {
    const items = scheduled.filter((s) => Math.ceil(s.month / 12) === y);
    return {
      label: `Year ${y}`,
      lowAud: round(items.reduce((t, s) => t + (s.costAud?.low ?? 0), 0)),
      highAud: round(items.reduce((t, s) => t + (s.costAud?.high ?? 0), 0)),
      budgetAud: y === 1 ? input.capacity.upfrontAud : input.capacity.yearlyAud,
    };
  });
  let lo = 0;
  let hi = 0;
  const runningTotal = phases.map((p) => {
    lo += p.costLowAud;
    hi += p.costHighAud;
    return { label: `After phase ${p.phase}`, lowAud: round(lo), highAud: round(hi) };
  });
  const monthly: MonthRow[] = [];
  for (let m = 1; m <= HORIZON_MONTHS; m++) {
    const c = cap[m] ?? 0;
    const w = work[m] ?? 0;
    const mt = maint[m] ?? 0;
    monthly.push({ month: m, calendarMonth: calendarMonthOf(m, input.startMonth), capacityHours: round(c), maintenanceHours: round(mt), workHours: round(w), freeHours: round(c - mt - w), costHighAud: round(spend[m] ?? 0) });
  }
  const costUnknown = input.actions.filter((a) => !a.done && a.materialsAud === null).map((a) => a.id);
  const notes = [
    "All costs are estimates in AUD from a dated cost reference. Check prices before you buy (FR-68).",
    "Actions are scheduled with their high labour and cost estimates, so the plan stays inside your capacity.",
  ];
  if (costUnknown.length) notes.push(`No cost data for: ${costUnknown.join(", ")}. Their cost is not counted in the budget table (FR-70).`);
  return {
    scheduled,
    phases,
    monthly,
    budgetTable: { byPhase: phases.map((p) => ({ label: `Phase ${p.phase}: ${p.name}`, lowAud: p.costLowAud, highAud: p.costHighAud })), byYear, runningTotal },
    deferred,
    costUnknown,
    notes,
  };
}

/** Step 7: rerun with +2 h/week and +50% budget and report what moves forward (FR-67). */
function exploreMore(input: ScheduleInput, base: ScheduleResult): NonNullable<ScheduleResult["whatMoreWouldAdd"]> {
  const extraHours = 2;
  const extraPct = 50;
  const hoursPerWeek = Object.fromEntries(SEASONS.map((s) => [s, Math.min(80, input.capacity.hoursPerWeek[s] + extraHours)])) as Record<Season, number>;
  const more = schedulePlan(
    { ...input, actions: input.actions as ActionInput[], capacity: { hoursPerWeek, upfrontAud: input.capacity.upfrontAud * 1.5, yearlyAud: input.capacity.yearlyAud * 1.5 } },
    { explore: false },
  );
  const label = (r: ScheduleResult, id: string) => {
    const s = r.scheduled.find((x) => x.actionId === id);
    return s ? { rank: s.phase === 0 ? 0 : s.phase, text: `Phase ${s.phase}` } : { rank: 9, text: "Deferred" };
  };
  const movedForward = input.actions
    .map((a) => ({ id: a.id, from: label(base, a.id), to: label(more, a.id) }))
    .filter((x) => x.to.rank < x.from.rank)
    .map((x) => ({ actionId: x.id, from: x.from.text, to: x.to.text }));
  const summary = movedForward.length
    ? `With ${extraHours} more hours per week and ${extraPct}% more budget, ${movedForward.map((m) => `${m.actionId} moves from ${m.from} to ${m.to}`).join("; ")}.`
    : `${extraHours} more hours per week and ${extraPct}% more budget would not move any action earlier.`;
  return { extraHoursPerWeek: extraHours, extraBudgetPercent: extraPct, movedForward, summary };
}

/** Mark an action done with its actual effort and reschedule the rest (FR-71). */
export function markDone(rawInput: z.input<typeof ScheduleInput>, actionId: string, done: { month: number; hours: number; costAud: number }): ScheduleResult {
  const input = ScheduleInput.parse(rawInput);
  if (!input.actions.some((a) => a.id === actionId)) throw new ScheduleError([`unknown action id '${actionId}'`]);
  const actions = input.actions.map((a) => (a.id === actionId ? { ...a, done } : a));
  return schedulePlan({ ...input, actions });
}
