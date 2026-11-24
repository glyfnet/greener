# Data files

| File | Holds | Status |
| --- | --- | --- |
| `question-bank.yaml` | The simple-mode question bank (spec Section 7.3). Compiled to JSON by `npm run build:index`. | Draft ranges (Q-15) |
| `cost-reference.csv` | Dated price ranges for materials (Section 7.7, FR-68). | **Empty.** TODO(Q-12): who collects the first prices, and from which nurseries and suppliers? |
| `declared-weeds.csv` | Declared weeds per state, used by `check_species` and `save_plan` to block planting (FR-24). | **Empty.** TODO: Section 8 lists "State declared weed lists (for example NSW WeedWise)" as *To check*. Add rows only from a verified source, with its URL and date, after the licence check in Q-20. |

## Rules

- Do not invent values. Every row needs a real `source` / `source_url` and an `as_of` date (CLAUDE.md rule 4).
- `cost-reference.csv` columns: `item,unit,low_aud,high_aud,region,source,as_of`. Ranges only, never a single value.
- `declared-weeds.csv` columns: `scientific_name,state,category,source_url,as_of`. Use the accepted ALA name.

While `declared-weeds.csv` is empty, the weed check still blocks species that ALA
records as introduced or invasive (`stateInvasive`) near the site. See
`docs/architecture.md`, "Species checks".
