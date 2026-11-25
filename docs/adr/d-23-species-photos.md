# D-23: Species photos — Wikimedia Commons links, reviewed by hand

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-26
- Decided by: the maintainer (asked for plant and animal photos in research and plan output, stored as links)
- Source: [specification Section 2](../specification.md#2-decision-log), [Section 8](../specification.md#8-data-sources-and-external-apis)
- Requirement: FR-17

## Context and problem

Users want to see what the recommended plants and animals look like. Photos need a licence that allows reuse, and a credit next to each one (NFR-17). The server must stay small and stateless (D-09, D-10), and it fetches only fixed hosts.

## Checked on 25–26 Nov 2026

- **ALA preferred images:** ALA species search gives an `image` ID, and `https://images.ala.org.au/ws/image/<id>` gives `creator`, `license` and `recognisedLicence`. Of the first-ranked images for five test species, three were CC BY-NC or CC BY-NC-SA, one had no licence, and one (koala, CC BY) had no creator. **Rejected:** most can't be used without accepting non-commercial licences.
- **Wikidata:** `action=query&generator=search&gsrsearch=haswbstatement:"P225=<name>"&prop=pageimages&piprop=name` returns the Commons file of the taxon's image (P18) in one request. It found an image for 16 of 17 test species.
- **Wikimedia Commons:** `action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320` gives `thumburl`, `descriptionurl` and `extmetadata` with `LicenseShortName` and `Artist` (HTML). Commons accepts only free licences, so it has no NC photos.
- **Results:** 16 photos were usable (CC0, public domain, CC BY 3.0, CC BY 3.0 au, CC BY-SA 3.0/4.0). Yellow box (*E. melliodora*) was refused because its file has no named creator.
- **Review matters:** one file's author field held instructions instead of a name, and one file is titled "Dorrigo Gum" for *E. michaeliana* (Hillgrove gum). Automated picks need a human check.

## Decision

- **Storage:** `data/species-images.csv`, one row per species: scientific name, ALA ID, flora or fauna, common name, thumbnail link, Commons file page, creator, licence, date recorded, and `reviewed`. `npm run build:index` validates it into the Worker bundle. Not the KB manifest, which holds documents for search. Not KV or D1, which would skip PR review.
- **Adding rows:** `npm run images:record -- <name>...` writes rows as `reviewed: no`. The maintainer checks each photo and sets `yes`.
- **Licences (in code):** only CC0, public domain, CC BY and CC BY-SA, each with a named creator (public domain and CC0 may say "Unknown"). `core/images.ts` enforces this for the file and for live lookups.
- **Live fallback:** `get_species_images` looks up species that aren't in the file. It runs ALA name matching, then Wikidata, then Commons: three requests per species, at most 12 species a call, cached 30 days. Live photos are always unreviewed.
- **Output:** links only, never image bytes: a thumbnail link (320 px), the file page, the creator, the licence, a credit line ("Photo: …, via Wikimedia Commons") and Markdown. Unreviewed photos are labelled "Example photo, not checked by Greener."

## Consequences

- `www.wikidata.org` and `commons.wikimedia.org` join `ALLOWED_HOSTS`. The user's device loads the image itself from `thumb.wikimedia.org` or `upload.wikimedia.org`.
- Only species names leave the server, never a location ([privacy](../privacy.md)).
- A photo shows the species, not the site. It isn't an identification guide.
- Next steps: show photos in the research report, plan and Markdown export. Then a species card (an MCP App), which must list the Wikimedia image hosts in its content security policy.
- TODO: should CC BY-NC photos be allowed? Greener is free and non-commercial, but it takes donations (D-16). This decision says no until the maintainer decides.
- TODO: test whether claude.ai shows Markdown images from outside hosts in chat replies.
