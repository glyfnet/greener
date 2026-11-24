import { describe, expect, it } from "vitest";
import { applyAnswer, capacityFromProfile, midpoint, nextQuestion, parseNumberedReply, QuestionBank, renderQuestionText, validateAnswer, visibleQuestions } from "../../src/core/questionnaire.js";
import { SiteProfile } from "../../src/core/models.js";
import { STATIC_DATA } from "../../src/data.js";
import { profile } from "../helpers.js";

const bank = STATIC_DATA.bank;
const q = (id: string) => {
  const found = bank.questions.find((x) => x.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("question bank (Section 7.3)", () => {
  it("is valid and has the 20 questions in order", () => {
    expect(() => QuestionBank.parse(bank)).not.toThrow();
    expect(bank.questions.map((x) => x.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("gives every question 2–6 options (FR-07)", () => {
    for (const x of bank.questions) expect(x.options.length).toBeGreaterThanOrEqual(2);
    for (const x of bank.questions) expect(x.options.length).toBeLessThanOrEqual(6);
  });

  it("offers Not sure on questions where the user may not know (FR-08)", () => {
    for (const id of ["soil", "sprays", "bushfire_prone", "wildlife_seen", "problems"]) expect(q(id).notSure).toBe(true);
  });

  it("rejects a bank with duplicate IDs", () => {
    const first = bank.questions[0];
    expect(QuestionBank.safeParse({ questions: [first, first] }).success).toBe(false);
  });
});

describe("skip logic (FR-10b)", () => {
  it("shows all 20 questions to a rural site", () => {
    expect(visibleQuestions(bank, profile({ site_type: { optionIds: ["rural"] } }).answers)).toHaveLength(20);
  });

  it("hides trees, soil and bushfire questions from an apartment", () => {
    const ids = visibleQuestions(bank, profile({ site_type: { optionIds: ["apartment"] } }).answers).map((x) => x.id);
    expect(ids).not.toContain("trees");
    expect(ids).not.toContain("soil");
    expect(ids).not.toContain("bushfire_prone");
    expect(ids).toHaveLength(17);
  });

  it("offers livestock only to rural sites", () => {
    const opts = (site: string) => visibleQuestions(bank, profile({ site_type: { optionIds: [site] } }).answers).find((x) => x.id === "animals")?.options.map((o) => o.id);
    expect(opts("rural")).toContain("livestock");
    expect(opts("suburban")).not.toContain("livestock");
  });

  it("drops hidden answers when the site type changes (FR-06)", () => {
    let p = profile({ site_type: { optionIds: ["rural"] }, soil: { optionIds: ["clay"] }, animals: { optionIds: ["dog", "livestock"] } });
    p = applyAnswer(bank, p, "site_type", { optionIds: ["apartment"] });
    expect(p.answers.soil).toBeUndefined();
    expect(p.answers.animals?.optionIds).toEqual(["dog"]);
  });
});

describe("answers", () => {
  it("walks to the next unanswered question with progress", () => {
    const n = nextQuestion(bank, profile({ location: { optionIds: ["use_my_location"] } }).answers);
    expect(n?.question.id).toBe("site_type");
    expect(n?.progress).toEqual({ index: 2, total: 20 });
  });

  it("skips skipped questions and ends when all are answered", () => {
    expect(nextQuestion(bank, {}, ["location"])?.question.id).toBe("site_type");
    const all = Object.fromEntries(bank.questions.map((x) => [x.id, { optionIds: [x.options[0]?.id ?? ""] }]));
    expect(nextQuestion(bank, all)).toBeUndefined();
  });

  it("validates option IDs, counts and Not sure", () => {
    expect(validateAnswer(q("site_type"), { optionIds: ["castle"] }).ok).toBe(false);
    expect(validateAnswer(q("site_type"), { optionIds: ["rural", "suburban"] }).ok).toBe(false);
    expect(validateAnswer(q("goals"), { optionIds: ["birds", "pollinators", "frogs_lizards", "bush_food"] }).ok).toBe(false);
    expect(validateAnswer(q("goals"), { optionIds: ["birds", "pollinators", "frogs_lizards"] }).ok).toBe(true);
    expect(validateAnswer(q("site_type"), { notSure: true }).ok).toBe(false);
    expect(validateAnswer(q("soil"), { notSure: true }).ok).toBe(true);
    expect(validateAnswer(q("soil"), {}).ok).toBe(false);
    expect(validateAnswer(q("water"), { optionIds: ["pond", "pond"] }).ok).toBe(false);
  });

  it("records a data gap for Not sure and clears it on a real answer (FR-08)", () => {
    let p = applyAnswer(bank, SiteProfile.parse({}), "soil", { optionIds: [], notSure: true });
    expect(p.dataGaps.map((g) => g.topic)).toEqual(["soil"]);
    p = applyAnswer(bank, p, "soil", { optionIds: ["clay"] });
    expect(p.dataGaps).toEqual([]);
  });

  it("does not change the input profile", () => {
    const p = profile();
    applyAnswer(bank, p, "site_type", { optionIds: ["rural"] });
    expect(p.answers.site_type).toBeUndefined();
  });
});

describe("numbered list fallback (FR-09)", () => {
  it("lists options, Not sure and Other with numbers", () => {
    const { text, choices } = renderQuestionText(q("soil"), { index: 9, total: 20 });
    expect(choices).toEqual(["Sandy", "Loam", "Clay", "Rocky or shallow", "Not sure", "Other (type an answer)"]);
    expect(text).toContain("Question 9 of 20: What is the soil like?");
    expect(text).toContain("5. Not sure");
    expect(renderQuestionText(q("bushfire_prone"), { index: 1, total: 1 }).choices).toContain("Not sure (we look it up)");
    expect(renderQuestionText(q("water"), { index: 1, total: 1 }).text).toContain("one or more");
    expect(renderQuestionText(q("goals"), { index: 1, total: 1 }).text).toContain("up to 3");
  });

  it("parses numbers into answers", () => {
    expect(parseNumberedReply(q("soil"), "3")).toEqual({ ok: true, answer: { optionIds: ["clay"] } });
    expect(parseNumberedReply(q("soil"), "5")).toEqual({ ok: true, answer: { optionIds: [], notSure: true } });
    expect(parseNumberedReply(q("soil"), "6", "black volcanic")).toEqual({ ok: true, answer: { optionIds: [], other: "black volcanic" } });
    expect(parseNumberedReply(q("water"), "2, 3").ok).toBe(true);
    expect(parseNumberedReply(q("soil"), "6").ok).toBe(false);
    expect(parseNumberedReply(q("soil"), "9").ok).toBe(false);
    expect(parseNumberedReply(q("soil"), "two").ok).toBe(false);
    expect(parseNumberedReply(q("site_type"), "1 2").ok).toBe(false);
  });
});

describe("capacity (FR-60)", () => {
  it("uses the high end of ranges and less time in summer", () => {
    const { capacity, gaps } = capacityFromProfile(bank, profile({ hours_per_week: { optionIds: ["h_2_5"] }, upfront_budget: { optionIds: ["aud_100_500"] }, yearly_budget: { optionIds: ["lt_100"] }, help: { optionIds: ["contractor"] } }));
    expect(capacity.hoursPerWeek).toEqual({ summer: 3.75, autumn: 5, winter: 5, spring: 5 });
    expect(capacity.upfrontAud).toBe(500);
    expect(capacity.yearlyAud).toBe(100);
    expect(capacity.paidHelp).toBe("contractor");
    expect(gaps).toEqual([]);
  });

  it("uses detailed values when given (FR-10a)", () => {
    const p = { ...profile(), detailed: { hoursPerWeekBySeason: { summer: 1, autumn: 2, winter: 3, spring: 4 }, upfrontBudgetAud: 250, yearlyBudgetAud: 50 } };
    const { capacity, gaps } = capacityFromProfile(bank, p);
    expect(capacity.hoursPerWeek.spring).toBe(4);
    expect(capacity.upfrontAud).toBe(250);
    expect(gaps).toEqual([]);
  });

  it("gives zero capacity and gaps when answers are missing, never a guess", () => {
    const { capacity, gaps } = capacityFromProfile(bank, profile());
    expect(capacity.upfrontAud).toBe(0);
    expect(capacity.hoursPerWeek.autumn).toBe(0);
    expect(capacity.paidHelp).toBe("unknown");
    expect(gaps).toEqual(["hours_per_week", "upfront_budget", "yearly_budget"]);
  });

  it("uses the middle of a range for calculations", () => {
    expect(midpoint([200, 1000])).toBe(600);
  });
});

describe("site strategies (FR-23)", async () => {
  const { siteStrategies, STRATEGY_CITATIONS } = await import("../../src/core/strategies.js");
  it("cites KB items that exist in the shipped index", () => {
    const ids = new Set(STATIC_DATA.kbIndex.chunks.map((c) => c.chunkId));
    for (const id of Object.values(STRATEGY_CITATIONS)) expect(ids.has(id)).toBe(true);
  });
  it("picks strategies from the answers", () => {
    expect(siteStrategies(profile({ site_type: { optionIds: ["townhouse"] }, tenure: { optionIds: ["strata"] } })).map((s) => [s.id, s.situation])).toEqual([["small_space", "Townhouse or courtyard"], ["removable", "Strata or shared site"]]);
    expect(siteStrategies(profile({ bushfire_prone: { notSure: true } })).map((s) => s.id)).toEqual(["bushfire_unknown"]);
    expect(siteStrategies(profile({ site_type: { optionIds: ["suburban"] }, tenure: { optionIds: ["own"] } }))).toEqual([]);
  });
});
