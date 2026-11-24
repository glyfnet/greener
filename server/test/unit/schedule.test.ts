import { describe, expect, it } from "vitest";
import { calendarMonthOf, inWindow, markDone, phaseOfMonth, schedulePlan, ScheduleError, seasonOf, WEEKS_PER_MONTH } from "../../src/core/schedule.js";
import type { ActionInput } from "../../src/core/models.js";
import { action } from "../helpers.js";

const cap = (h: number, upfront = 1000, yearly = 500) => ({ hoursPerWeek: { summer: h, autumn: h, winter: h, spring: h }, upfrontAud: upfront, yearlyAud: yearly });
const run = (actions: ActionInput[], capacity = cap(2), startMonth = 3) => schedulePlan({ actions, capacity, startMonth });
const monthOf = (r: ReturnType<typeof run>, id: string) => r.scheduled.find((s) => s.actionId === id)?.month;

describe("calendar helpers", () => {
  it("maps months to southern-hemisphere seasons", () => {
    expect([12, 1, 2].map(seasonOf)).toEqual(["summer", "summer", "summer"]);
    expect([3, 6, 9].map(seasonOf)).toEqual(["autumn", "winter", "spring"]);
  });
  it("handles windows that wrap the year end", () => {
    expect(inWindow(1, { startMonth: 11, endMonth: 2 })).toBe(true);
    expect(inWindow(6, { startMonth: 11, endMonth: 2 })).toBe(false);
    expect(inWindow(4, { startMonth: 3, endMonth: 5 })).toBe(true);
  });
  it("maps plan months to calendar months and phases", () => {
    expect(calendarMonthOf(1, 11)).toBe(11);
    expect(calendarMonthOf(3, 11)).toBe(1);
    expect([1, 6, 7, 18, 19, 36].map(phaseOfMonth)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe("schedulePlan (Section 7.7)", () => {
  it("puts a small cheap first action in quick wins (Phase 0)", () => {
    const r = run([action("a", { labourHours: { low: 1, high: 3 }, materialsAud: { low: 10, high: 50 } })]);
    expect(r.scheduled[0]).toMatchObject({ actionId: "a", month: 1, phase: 0 });
  });

  it("never uses more hours in a month than the capacity formula allows (FR-63)", () => {
    const monthly = 2 * WEEKS_PER_MONTH * 0.8; // 6.928 h
    const actions = ["a", "b", "c", "d"].map((id) => action(id, { labourHours: { low: 3, high: 5 }, materialsAud: null }));
    const r = run(actions);
    for (const m of r.monthly) expect(m.workHours + m.maintenanceHours).toBeLessThanOrEqual(monthly + 1e-6);
    expect(r.scheduled.map((s) => s.month)).toEqual([1, 2, 3, 4]);
  });

  it("schedules with the high labour estimate", () => {
    const r = run([action("big", { labourHours: { low: 1, high: 7 } })]);
    expect(r.deferred[0]).toMatchObject({ actionId: "big", reason: "time" });
    expect(r.deferred[0]?.extraHoursPerWeek).toBeCloseTo((7 - 2 * WEEKS_PER_MONTH * 0.8) / (WEEKS_PER_MONTH * 0.8), 2);
  });

  it("starts an action after its dependencies finish", () => {
    const r = run([action("plant", { dependsOn: ["weed"], priority: "high" }), action("weed", { priority: "low" })]);
    expect(monthOf(r, "weed")).toBe(1);
    expect(monthOf(r, "plant")).toBe(2);
  });

  it("orders by priority, then benefit per hour", () => {
    const r = run([action("low", { priority: "low", labourHours: { low: 5, high: 6 } }), action("high", { priority: "high", labourHours: { low: 5, high: 6 } })]);
    expect(monthOf(r, "high")).toBe(1);
    expect(monthOf(r, "low")).toBe(2);
    const r2 = run([action("slow", { benefit: 3, labourHours: { low: 5, high: 6 } }), action("fast", { benefit: 3, labourHours: { low: 1, high: 1 } })]);
    expect(monthOf(r2, "fast")).toBe(1);
  });

  it("respects the work window (season)", () => {
    // Start in March; a June–July window gives plan month 4.
    const r = run([action("winter", { window: { startMonth: 6, endMonth: 7 } })]);
    expect(monthOf(r, "winter")).toBe(4);
  });

  it("reduces later capacity by maintenance (FR-64)", () => {
    const r = run([action("pond", { priority: "high", maintenanceHoursPerMonth: 4, labourHours: { low: 1, high: 1 } }), action("bed", { labourHours: { low: 4, high: 4 } })]);
    expect(monthOf(r, "pond")).toBe(1);
    // Month 2+ has 6.93 - 4 = 2.93 free hours, so the 4 h bed goes in month 1 alongside the pond.
    expect(monthOf(r, "bed")).toBe(1);
    expect(r.monthly[1]?.maintenanceHours).toBe(4);
  });

  it("does not place an action whose upkeep would overload later months", () => {
    const r = run([action("first", { priority: "high", labourHours: { low: 6, high: 6 } }), action("upkeep", { window: { startMonth: 3, endMonth: 3 }, maintenanceHoursPerMonth: 1, labourHours: { low: 0.5, high: 0.5 } })], cap(2), 3);
    // Month 1 has 0.93 h left: the 0.5 h action fits, and its 1 h upkeep fits later months.
    expect(monthOf(r, "upkeep")).toBe(1);
    const r2 = run([action("filler", { labourHours: { low: 6.5, high: 6.5 }, window: { startMonth: 4, endMonth: 4 } }), action("upkeep", { priority: "high", maintenanceHoursPerMonth: 1, window: { startMonth: 3, endMonth: 3 }, labourHours: { low: 0.5, high: 0.5 } })], cap(2), 3);
    expect(monthOf(r2, "upkeep")).toBe(1);
    expect(r2.deferred.map((d) => d.actionId)).toContain("filler");
  });

  it("keeps spending inside the cumulative budget and defers for money (FR-63, FR-66)", () => {
    const r = run([action("a", { materialsAud: { low: 600, high: 800 } }), action("b", { materialsAud: { low: 600, high: 800 } })], cap(10, 1000, 500));
    expect(monthOf(r, "a")).toBe(1);
    // Month 13 has $1,500 in total, not enough for $1,600; month 25 has $2,000.
    expect(monthOf(r, "b")).toBe(25);
    const tooBig = run([action("x", { materialsAud: { low: 5000, high: 9000 } })], cap(10, 1000, 500));
    expect(tooBig.deferred[0]).toMatchObject({ actionId: "x", reason: "money", extraAud: 7000 });
  });

  it("defers dependants of a deferred action", () => {
    const r = run([action("huge", { labourHours: { low: 50, high: 99 } }), action("after", { dependsOn: ["huge"] })]);
    expect(r.deferred.map((d) => [d.actionId, d.reason])).toEqual([["huge", "time"], ["after", "dependency"]]);
  });

  it("defers for season when no window month is left", () => {
    const r = run([action("first", { window: { startMonth: 3, endMonth: 3 }, labourHours: { low: 6, high: 6.9 } }), action("next", { dependsOn: ["first"], window: { startMonth: 3, endMonth: 3 } })], cap(2), 3);
    expect(monthOf(r, "first")).toBe(1);
    expect(monthOf(r, "next")).toBe(13);
  });

  it("reports what more time or money would add (FR-67)", () => {
    const r = run([action("big", { labourHours: { low: 8, high: 10 } })]);
    expect(r.whatMoreWouldAdd?.movedForward.map((m) => [m.actionId, m.from])).toEqual([["big", "Deferred"]]);
    expect(r.whatMoreWouldAdd?.summary).toContain("big moves from Deferred");
  });

  it("builds a budget table by phase and year with a running total (FR-65)", () => {
    const r = run([action("a", { materialsAud: { low: 10, high: 30 } }), action("b", { labourHours: { low: 5, high: 6 }, materialsAud: { low: 100, high: 200 } })], cap(2, 1000));
    const total = r.budgetTable.runningTotal.at(-1);
    expect(total).toEqual({ label: "After phase 3", lowAud: 110, highAud: 230 });
    expect(r.budgetTable.byYear[0]).toMatchObject({ label: "Year 1", lowAud: 110, highAud: 230, budgetAud: 1000 });
  });

  it("says when an action has no cost data (FR-70)", () => {
    const r = run([action("a", { materialsAud: null })]);
    expect(r.costUnknown).toEqual(["a"]);
    expect(r.notes.join(" ")).toContain("No cost data for: a");
    expect(r.scheduled[0]?.costAud).toBeNull();
  });

  it("rejects bad input with clear errors", () => {
    expect(() => run([action("a"), action("a")])).toThrow(ScheduleError);
    expect(() => run([action("a", { dependsOn: ["ghost"] })])).toThrow(/unknown action 'ghost'/);
    expect(() => run([action("a", { dependsOn: ["b"] }), action("b", { dependsOn: ["a"] })])).toThrow(/cycle/);
    expect(() => run([action("a", { dependsOn: ["a"] })])).toThrow(/itself/);
  });

  it("is deterministic", () => {
    const actions = [action("a"), action("b", { priority: "high" }), action("c", { dependsOn: ["a"] })];
    expect(run(actions)).toEqual(run(actions));
  });
});

describe("markDone (FR-71)", () => {
  it("fixes the done action at its month with actual effort and reschedules the rest", () => {
    const actions = [action("a", { labourHours: { low: 2, high: 3 } }), action("b", { labourHours: { low: 5, high: 6 } })];
    const r = markDone({ actions, capacity: cap(2), startMonth: 3 }, "a", { month: 2, hours: 6, costAud: 5 });
    expect(r.scheduled.find((s) => s.actionId === "a")).toMatchObject({ month: 2, done: true, labourHoursHigh: 6, costAud: { low: 5, high: 5 } });
    expect(monthOf(r, "b")).toBe(1);
  });

  it("rejects an unknown action", () => {
    expect(() => markDone({ actions: [action("a")], capacity: cap(2), startMonth: 1 }, "zz", { month: 1, hours: 1, costAud: 1 })).toThrow(ScheduleError);
  });
});
