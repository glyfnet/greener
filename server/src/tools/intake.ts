/**
 * Intake tools (Section 7.2 `site-intake`, Section 7.3, FR-01–FR-10b).
 * All are stateless: the draft profile travels in each call (D-09).
 */
import { z } from "zod";
import { Answer, Location, SiteProfile } from "../core/models.js";
import { applyAnswer, capacityFromProfile, findQuestion, nextQuestion, renderQuestionText, validateAnswer, visibleQuestions, type Question, type QuestionBank } from "../core/questionnaire.js";
import { bushfireProne } from "../connectors/bushfire.js";
import { pendingGap } from "../connectors/pending.js";
import { fail, ok } from "./context.js";
import { defineTool } from "./define.js";

export const INTAKE_CARD_URI = "ui://intake-card";

const Draft = SiteProfile.optional().describe("The site profile so far. Omit to start a new site.");

function questionPayload(q: Question, progress: { index: number; total: number }) {
  const { text, choices } = renderQuestionText(q, progress);
  return {
    question: { id: q.id, number: q.number, text: q.text, kind: q.kind, select: q.select, notSure: q.notSure, options: q.options.map((o) => ({ id: o.id, label: o.label, ...(o.icon ? { icon: o.icon } : {}) })) },
    progress,
    numberedList: text,
    choices,
  };
}

/** Missing or conflicting answers worth one follow-up each, at most 3 (FR-04). */
export function followUps(bank: QuestionBank, profile: SiteProfile): string[] {
  const out: string[] = [];
  const a = (id: string) => profile.answers[id]?.optionIds ?? [];
  const site = a("site_type")[0];
  const area = a("area")[0];
  if (site === "apartment" && area && !["lt_20m2", "m2_20_200"].includes(area)) out.push("You chose an apartment or balcony but a large area. Is the area you can change really that big?");
  if (site === "apartment" && a("land_cover").includes("pasture")) out.push("You chose an apartment but pasture as the land cover. Which is right?");
  if (a("water").includes("none") && a("water").length > 1) out.push("You chose no water and also a water feature. Which is right?");
  if (a("animals").includes("none") && a("animals").length > 1) out.push("You chose no animals and also some animals. Which is right?");
  if (a("problems").includes("none_known") && a("problems").length > 1) out.push("You chose no known problems and also some problems. Which is right?");
  if (!profile.location) out.push("Where is the site? Share your location, or give a suburb or coordinates.");
  for (const q of visibleQuestions(bank, profile.answers)) {
    if (out.length >= 3) break;
    const ans = profile.answers[q.id];
    if (ans?.other && ans.optionIds.length === 0) out.push(`For "${q.text}" you wrote "${ans.other}". Does one of the options fit?`);
  }
  return out.slice(0, 3);
}

export const getQuestionBank = defineTool({
  name: "get_question_bank",
  title: "Get question bank",
  description: "Get the site questions, their options and the skip logic. Use at the start of an intake. Pass the profile so far to get only the questions that apply to this site (FR-10b).",
  input: z.object({ profile: Draft }),
  handler: ({ profile }, ctx) => {
    const p = profile ?? SiteProfile.parse({});
    const qs = visibleQuestions(ctx.data.bank, p.answers);
    return ok({ mode: p.mode, total: qs.length, questions: qs.map((q, i) => questionPayload(q, { index: i + 1, total: qs.length }).question), notes: ["Every question also has an Other option for a free-text answer (FR-08).", "Numeric options are ranges. Use the middle for calculations (Section 7.3)."] });
  },
});

export const askQuestion = defineTool({
  name: "ask_question",
  title: "Ask a question",
  description: "Show one intake question as a card with buttons (MCP App). Hosts without MCP Apps get a numbered list in the text (FR-09). Omit questionId to get the next unanswered question; skipIds lists questions the user skipped for now.",
  input: z.object({ profile: Draft, questionId: z.string().optional(), skipIds: z.array(z.string()).max(30).default([]) }),
  meta: { ui: { resourceUri: INTAKE_CARD_URI }, "ui/resourceUri": INTAKE_CARD_URI },
  handler: ({ profile, questionId, skipIds }, ctx) => {
    const p = profile ?? SiteProfile.parse({});
    let payload;
    if (questionId) {
      const visible = visibleQuestions(ctx.data.bank, p.answers);
      const i = visible.findIndex((q) => q.id === questionId);
      const q = visible[i];
      if (!q) return fail(`No question '${questionId}' applies to this site.`, [`Valid IDs: ${visible.map((v) => v.id).join(", ")}`]);
      payload = questionPayload(q, { index: i + 1, total: visible.length });
    } else {
      const next = nextQuestion(ctx.data.bank, p.answers, skipIds);
      if (!next) return ok({ complete: true, profile: p, followUps: followUps(ctx.data.bank, p) }, "All questions are answered. Call save_profile to check and save the profile.");
      payload = questionPayload(next.question, next.progress);
    }
    return ok({ complete: false, profile: p, ...payload }, payload.numberedList);
  },
});

export const saveAnswer = defineTool({
  name: "save_answer",
  title: "Save an answer",
  description: "Save one answer and get the next question. Also use it to change one answer later without repeating the questionnaire (FR-06). Returns the updated profile: keep it and pass it to the next call.",
  input: z.object({ profile: Draft, questionId: z.string().min(1), answer: Answer, location: Location.optional().describe("Only for the location question") }),
  meta: { ui: { resourceUri: INTAKE_CARD_URI }, "ui/resourceUri": INTAKE_CARD_URI },
  handler: ({ profile, questionId, answer, location }, ctx) => {
    const p = profile ?? SiteProfile.parse({});
    const q = findQuestion(ctx.data.bank, p.answers, questionId);
    if (!q) return fail(`No question '${questionId}' applies to this site.`, ["Call get_question_bank to see the questions for this site."]);
    const v = validateAnswer(q, answer);
    if (!v.ok) return fail(`That answer does not fit question '${questionId}'.`, v.errors);
    let updated = applyAnswer(ctx.data.bank, p, questionId, v.answer);
    if (location) updated = { ...updated, location };
    const next = nextQuestion(ctx.data.bank, updated.answers);
    if (!next) return ok({ saved: questionId, complete: true, profile: updated, followUps: followUps(ctx.data.bank, updated) }, "All questions are answered. Call save_profile to check and save the profile.");
    const payload = questionPayload(next.question, next.progress);
    return ok({ saved: questionId, complete: false, profile: updated, ...payload }, payload.numberedList);
  },
});

export const geocode = defineTool({
  name: "geocode",
  title: "Find site coordinates",
  description: "Turn the user's location into site coordinates (FR-02). Pass lat and lon from the user's current location or typed coordinates. Address and suburb lookup is not available yet; the result says so.",
  input: z.object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    query: z.string().max(200).optional().describe("Address, suburb or postcode"),
    label: z.string().max(200).optional(),
  }),
  handler: ({ lat, lon, query, label }) => {
    if (lat !== undefined && lon !== undefined) {
      const loc = Location.safeParse({ lat, lon, label: label ?? query, precision: "exact" });
      if (!loc.success) return fail("Those coordinates are not in Australia.", ["latitude must be between -44 and -10", "longitude must be between 112 and 154"]);
      return ok({ location: loc.data, note: "Release 1 has NSW data only (D-02). Outside NSW, results may be incomplete." });
    }
    if (query) {
      return ok({ location: null, dataGap: pendingGap("geocode"), nextStep: "Ask the user to share their current location, or to give latitude and longitude. Then call geocode again with lat and lon." });
    }
    return fail("Give lat and lon, or a query.", ["Example: { lat: -33.87, lon: 151.21 }"]);
  },
});

export const bushfireStatus = defineTool({
  name: "bushfire_status",
  title: "Look up bushfire-prone land",
  description:
    "Look up whether the site is on NSW bushfire-prone land (FR-03, D-18), from the NSW RFS Bush Fire Prone Land map. Use when the user answered Not sure, or to check their answer. Checks land within about 100 m of the site. Returns a suggested answer for the bushfire_prone question and a citation. The council's certified map is authoritative.",
  input: z.object({ location: Location }),
  handler: async ({ location }, ctx) => {
    const r = await bushfireProne(location.lat, location.lon, ctx.http, ctx.today);
    if (!r.ok) return ok({ status: "unknown", dataGap: r.dataGap, requirement: "FR-03", nextStep: "Tell the user the status is unknown. Suggest they check their council's bushfire-prone land map. The plan will add bushfire cautions." });
    const prone = r.status === "prone";
    return ok({
      status: r.status,
      categories: r.categories,
      ...(r.mapUpdated ? { mapUpdated: r.mapUpdated } : {}),
      suggestedAnswer: { questionId: "bushfire_prone", answer: { optionIds: [prone ? "yes" : "no"] } },
      citation: r.citation,
      notes: [
        prone ? "Bushfire-prone land is mapped within about 100 m of the site." : "No bushfire-prone land is mapped within about 100 m of the site.",
        "This is a map check, not a planning certificate. The council's certified bushfire-prone land map, and a Bushfire Attack Level (BAL) assessment for building work, are authoritative.",
        ...(location.precision === "approximate" ? ["The site location is approximate, so the result may not match the exact property."] : []),
      ],
      nextStep: "Tell the user the result and ask them to confirm it. Then call save_answer with the suggested answer, and add the citation to the research report.",
    });
  },
});

export const saveProfile = defineTool({
  name: "save_profile",
  title: "Check and save the site profile",
  description: "Validate the full site profile against the schema and the question bank. Use at the end of the intake, or to load answers from a JSON or YAML file the user gave (FR-05). On success, save the returned profile as profile.json in the user's Project. The server keeps nothing (D-09).",
  input: z.object({ profile: z.unknown().describe("The whole site profile") }),
  handler: ({ profile }, ctx) => {
    const parsed = SiteProfile.safeParse(profile);
    if (!parsed.success) return fail("The profile does not match the schema.", parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`));
    const p = parsed.data;
    const errors: string[] = [];
    const visible = new Map(visibleQuestions(ctx.data.bank, p.answers).map((q) => [q.id, q]));
    for (const [id, ans] of Object.entries(p.answers)) {
      const q = visible.get(id);
      if (!q) {
        errors.push(`answers.${id}: not a question for this site`);
        continue;
      }
      const v = validateAnswer(q, ans);
      if (!v.ok) errors.push(...v.errors.map((e) => `answers.${id}: ${e}`));
    }
    if (errors.length) return fail("Some answers do not fit the question bank.", errors);
    const missing = [...visible.keys()].filter((id) => !p.answers[id] && id !== "location");
    if (!p.location) missing.unshift("location");
    const { capacity, gaps } = capacityFromProfile(ctx.data.bank, p);
    return ok({ profile: p, complete: missing.length === 0, missing, followUps: followUps(ctx.data.bank, p), capacity, capacityGaps: gaps, saveAs: "profile.json" });
  },
});

export const getSite = defineTool({
  name: "get_site",
  title: "Summarise a site file",
  description: "Summarise the user's saved site file: answers, capacity, data gaps and what is still missing. Use at the start of research, planning or a question, after reading profile.json from the user's Project.",
  input: z.object({ profile: SiteProfile }),
  handler: ({ profile }, ctx) => {
    const { capacity, gaps } = capacityFromProfile(ctx.data.bank, profile);
    const next = nextQuestion(ctx.data.bank, profile.answers);
    const summary = Object.fromEntries(Object.entries(profile.answers).map(([id, a]) => [id, a.notSure ? "not sure" : [...a.optionIds, ...(a.other ? [`other: ${a.other}`] : [])].join(", ")]));
    return ok({
      location: profile.location ? { label: profile.location.label, state: profile.location.state, precision: profile.location.precision, hasCoordinates: true } : null,
      answers: summary,
      capacity,
      capacityGaps: gaps,
      dataGaps: profile.dataGaps,
      nextUnanswered: next?.question.id ?? null,
      localPrices: profile.localPrices.length,
    });
  },
});

export const intakeTools = [getQuestionBank, askQuestion, saveAnswer, geocode, bushfireStatus, saveProfile, getSite];
