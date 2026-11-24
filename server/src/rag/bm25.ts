/**
 * Keyword (BM25) search over the global KB (D-06, Section 7.4).
 *
 * The index is built offline by `npm run build:index` and ships with the
 * Worker. Query time is a few map lookups, which keeps each call well inside
 * the free-plan CPU limit (D-10).
 */
import { z } from "zod";

export const K1 = 1.2;
export const B = 0.75;

const STOP = new Set(
  "a an and are as at be by can do for from has have how i if in is it its of on or our so that the their them then there these this to was we what when where which who why will with you your".split(" "),
);

/** Lower-case word tokens with stop words removed. Keeps digits (e.g. "10km"). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

/** Words that look plural but are not, or whose singular is the same. */
const INVARIANT = new Set(["species", "series", "grass", "moss", "class", "bus", "gas", "this", "has", "was", "is", "its"]);

/** A very light suffix stripper so "plants" matches "plant". */
export function stem(t: string): string {
  if (INVARIANT.has(t)) return t;
  if (t.length > 4 && t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

export const IndexedChunk = z.object({
  chunkId: z.string(),
  itemId: z.string(),
  title: z.string(),
  heading: z.string(),
  text: z.string().describe("Full chunk text for open content; the summary for link-catalogue items"),
  tier: z.enum(["open_content", "link_catalogue"]),
  url: z.string(),
  publisher: z.string(),
  licence: z.string(),
  region: z.string(),
  dateChecked: z.string(),
  tags: z.array(z.string()),
  accessLevel: z.literal("public").describe("Only public items exist in MVP; IEK access levels are Phase 3 (Section 9)"),
});
export type IndexedChunk = z.infer<typeof IndexedChunk>;

export const KbIndex = z.object({
  version: z.literal(1),
  builtAt: z.string(),
  chunks: z.array(IndexedChunk),
  docLengths: z.array(z.number()),
  avgDocLength: z.number(),
  /** term → list of [chunk index, term frequency] */
  postings: z.record(z.string(), z.array(z.tuple([z.number(), z.number()]))),
});
export type KbIndex = z.infer<typeof KbIndex>;

/** Build the index from chunks. Title, heading and tags are added to each chunk's terms. */
export function buildIndex(chunks: IndexedChunk[], builtAt: string): KbIndex {
  const postings: Record<string, [number, number][]> = {};
  const docLengths: number[] = [];
  chunks.forEach((c, i) => {
    const toks = tokenize(`${c.title} ${c.heading} ${c.tags.join(" ")} ${c.text}`);
    docLengths.push(toks.length);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) (postings[t] ??= []).push([i, n]);
  });
  const avgDocLength = docLengths.length ? docLengths.reduce((a, b) => a + b, 0) / docLengths.length : 0;
  return { version: 1, builtAt, chunks, docLengths, avgDocLength, postings };
}

export interface SearchFilter {
  /** Region filter: items for this region or for all of Australia. */
  region?: string;
  tiers?: IndexedChunk["tier"][];
}

export interface SearchHit {
  chunk: IndexedChunk;
  score: number;
}

/** Access filter: runs before scoring, so a hidden item can never be returned (Section 7.4, IEK-04). */
function allowed(c: IndexedChunk, f: SearchFilter): boolean {
  if (c.accessLevel !== "public") return false;
  if (f.tiers && !f.tiers.includes(c.tier)) return false;
  if (f.region) {
    const want = f.region.toLowerCase();
    const have = c.region.toLowerCase();
    if (!(have === "australia" || have === want || have.startsWith(`${want} `) || want.startsWith(`${have} `))) return false;
  }
  return true;
}

/**
 * BM25 search, then re-rank the top 30 and return the top `limit` (default 8)
 * with at most two chunks per item (Section 7.4 steps 5–6).
 */
export function search(index: KbIndex, query: string, filter: SearchFilter = {}, limit = 8): SearchHit[] {
  const terms = [...new Set(tokenize(query))];
  const N = index.chunks.length;
  const scores = new Map<number, number>();
  for (const t of terms) {
    const plist = index.postings[t];
    if (!plist) continue;
    const idf = Math.log(1 + (N - plist.length + 0.5) / (plist.length + 0.5));
    for (const [i, tf] of plist) {
      const c = index.chunks[i];
      if (!c || !allowed(c, filter)) continue;
      const dl = index.docLengths[i] ?? 0;
      const s = (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * dl) / (index.avgDocLength || 1)));
      scores.set(i, (scores.get(i) ?? 0) + s);
    }
  }
  const top30 = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 30);
  // Re-rank: small boost when query terms hit the title or tags.
  const reranked = top30
    .map(([i, s]) => {
      const c = index.chunks[i] as IndexedChunk;
      const meta = new Set(tokenize(`${c.title} ${c.tags.join(" ")}`));
      const boost = terms.filter((t) => meta.has(t)).length * 0.1;
      return { chunk: c, score: s * (1 + boost) };
    })
    .sort((a, b) => b.score - a.score || a.chunk.chunkId.localeCompare(b.chunk.chunkId));
  const perItem = new Map<string, number>();
  const out: SearchHit[] = [];
  for (const h of reranked) {
    const n = perItem.get(h.chunk.itemId) ?? 0;
    if (n >= 2) continue;
    perItem.set(h.chunk.itemId, n + 1);
    out.push({ chunk: h.chunk, score: Math.round(h.score * 1000) / 1000 });
    if (out.length >= limit) break;
  }
  return out;
}
