/**
 * Knowledge search (Section 7.4, FR-40–FR-46).
 */
import { z } from "zod";
import { search } from "../rag/bm25.js";
import { ok } from "./context.js";
import { defineTool } from "./define.js";

const MAX_TEXT = 1200;

export const searchKnowledge = defineTool({
  name: "search_knowledge",
  title: "Search the global knowledge base",
  description:
    "Keyword search of the global Greener knowledge base (FR-44). Returns up to 8 passages with citation IDs. For link-catalogue results, read the live page at the URL with web fetch and cite it (FR-46). Search the user's own Project files yourself as well: the local KB never goes to the server (FR-43).",
  input: z.object({
    query: z.string().min(2).max(300),
    region: z.string().max(60).optional().describe("e.g. 'NSW'. Items for all of Australia always match."),
    tier: z.enum(["open_content", "link_catalogue"]).optional(),
    limit: z.number().int().min(1).max(8).default(8),
  }),
  handler: ({ query, region, tier, limit }, ctx) => {
    const hits = search(ctx.data.kbIndex, query, { ...(region ? { region } : {}), ...(tier ? { tiers: [tier] } : {}) }, limit);
    return ok({
      results: hits.map((h) => ({
        citationId: h.chunk.chunkId,
        kb: "global",
        title: h.chunk.title,
        heading: h.chunk.heading,
        tier: h.chunk.tier,
        url: h.chunk.url,
        publisher: h.chunk.publisher,
        licence: h.chunk.licence,
        region: h.chunk.region,
        dateChecked: h.chunk.dateChecked,
        text: h.chunk.text.length > MAX_TEXT ? `${h.chunk.text.slice(0, MAX_TEXT)}…` : h.chunk.text,
        score: h.score,
        ...(h.chunk.tier === "link_catalogue" ? { readLive: "This is our summary. Read the live page at url and cite it. If web access is off, use this summary and say the live page was not read (FR-46)." } : {}),
      })),
      indexBuiltAt: ctx.data.kbIndex.builtAt,
      ...(hits.length ? {} : { note: "The global KB has nothing on this. Say so; do not guess (FR-32)." }),
    });
  },
});

export const knowledgeTools = [searchKnowledge];
