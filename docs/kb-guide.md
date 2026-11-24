# Knowledge-base guide

The global KB is curated by the maintainer (D-11) and has two tiers (D-15, FR-42). Everything lives in `kb/`: `manifest.yaml` holds the metadata and `sources/` holds open-content Markdown.

## Choose the tier

| Tier | Use when | What goes in the repo |
| --- | --- | --- |
| `open_content` | The licence permits redistribution (CC BY 4.0, CC BY 3.0 AU, CC0), you wrote the text yourself (`licence: maintainer`), or you have written permission (`licence: permission` plus a `permission` record) | Full text in `kb/sources/<id>.md` |
| `link_catalogue` | Anything else | URL, metadata and a summary in your own words |

## Metadata (FR-41)

Every item needs `id`, `title`, `sourceUrl`, `publisher`, `licence`, `tier`, `region` (`NSW`, `NSW coast`, `Australia` …), `dateChecked` (`YYYY-MM-DD`) and `tags`. Open content also needs `file`; catalogue items need `summary`. Maintainer-written text can use its own path as `sourceUrl`, for example `kb/sources/<id>.md`.

## Write a catalogue summary

- At least 80 words, and useful on its own: Claude falls back to it when web access is off (FR-46).
- Include the key facts, species, steps and figures, **in your own words**. No copied passages.
- Plain English, with short sentences (NFR-18).

## Check and build

```bash
npm run check:kb             # metadata, tiers, licences, and a link check (warning only)
npm run check:kb -- --strict # what release runs: broken links fail
npm run build:index          # rebuild the index that ships with the server
```

Q-20: record the permission or licence for each council planting list and state weed list in the manifest. The terms decide its tier.
