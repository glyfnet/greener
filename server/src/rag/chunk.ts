/**
 * Split Markdown into chunks for the index (Section 7.4 step 2).
 *
 * About 500 tokens per chunk with 15% overlap. Tokens are estimated as
 * words × 1.3, so a chunk is about 385 words. Each chunk keeps its heading
 * path as context.
 */

export const TARGET_TOKENS = 500;
export const OVERLAP = 0.15;
const TOKENS_PER_WORD = 1.3;

export interface TextChunk {
  heading: string;
  text: string;
}

export function chunkMarkdown(markdown: string, targetTokens = TARGET_TOKENS, overlap = OVERLAP): TextChunk[] {
  const maxWords = Math.max(20, Math.floor(targetTokens / TOKENS_PER_WORD));
  const step = Math.max(1, Math.floor(maxWords * (1 - overlap)));
  const sections: { heading: string; words: string[] }[] = [];
  const path: string[] = [];
  let current: { heading: string; words: string[] } = { heading: "", words: [] };
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m && m[1] && m[2] !== undefined) {
      if (current.words.length) sections.push(current);
      const depth = m[1].length;
      path.length = depth - 1;
      path[depth - 1] = m[2].trim();
      current = { heading: path.filter(Boolean).join(" > "), words: [] };
    } else {
      current.words.push(...line.split(/\s+/).filter(Boolean));
    }
  }
  if (current.words.length) sections.push(current);
  const chunks: TextChunk[] = [];
  for (const s of sections) {
    for (let start = 0; start < s.words.length; start += step) {
      chunks.push({ heading: s.heading, text: s.words.slice(start, start + maxWords).join(" ") });
      if (start + maxWords >= s.words.length) break;
    }
  }
  return chunks;
}
