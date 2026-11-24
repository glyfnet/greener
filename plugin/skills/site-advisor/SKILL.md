---
name: site-advisor
description: Use when the user asks a free-text question about their site, its species, its plan or biodiversity on their land, or runs /greener-ask.
---

# Site advisor

Implements FR-30–FR-34 and FR-44–FR-46.

1. Read the site files you have (`profile.json`, `research.json`, the latest plan). Call `search_site` with the question and those files.
2. Call `search_knowledge` for the global KB, and search the user's own Project documents for the local KB (FR-44).
3. For a plan question, call `get_plan_section` instead of reading the whole plan.
4. For a species not in the site data, call `ala_species_profile`, and `weed_status` if it is about planting (FR-33).
5. For a link-catalogue result, read the live page at its URL and cite it. If web access is off, ask the user to turn it on. Without it, answer from the summary and say that the live page was not read (FR-46).
6. Answer in plain English, with short sentences (NFR-18). Cite every factual claim, and say whether it came from the global KB, the user's documents or the site research (FR-31, FR-44).
7. If nothing answers the question, say so. Do not guess (FR-32).
8. Keep the conversation in the site's Project so the history stays with the site (FR-34).

See `docs/specification.md` Sections 4.4 and 7.4.
