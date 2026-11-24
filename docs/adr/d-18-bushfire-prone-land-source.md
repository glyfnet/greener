# D-18: Bushfire-prone land source — NSW RFS Bush Fire Prone Land map

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-25
- Decided by: the maintainer (requested a decision row per data source)
- Source: [specification Section 2](../specification.md#2-decision-log), [Section 8](../specification.md#8-data-sources-and-external-apis)
- Requirement: FR-03

## Context and problem

`bushfire_status` returned a data gap, so a user who answered *Not sure* got the cautious `bushfire_unknown` strategy. Section 8 listed "State planning spatial services" as a candidate.

## Checked on 25 Nov 2026

- Dataset: [Bush Fire Prone Land](https://data.nsw.gov.au/data/dataset/bush-fire-prone-land) on data.nsw. The organisation is the NSW Rural Fire Service. The CKAN licence is `cc-by`. The ArcGIS item (`84c338fe2e8c49a9836751ed49c9c581`) gives the licence as "CC by NSW RFS" with the attribution "NSW Rural Fire Service 2026".
- Service: `https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0/query` (polygon layer `NSWBushFireProneLand`). The fields used are `category`, `d_category`, `d_guidelin` and `lastupdate`.
- A copy of the same data at `mapprod3.environment.nsw.gov.au/.../Fire/BFPL/MapServer/0` returned the same polygon at the test point. `mapuat3` is a test server and is not used.
- Recorded fixtures (`server/test/fixtures/bushfire/`), using a ±0.001° envelope:
  - Hyde Park, Sydney: no polygon.
  - Katoomba escarpment (−33.733, 150.313): "Vegetation Category 1" (category 1) and "Vegetation Buffer" (category 0), guideline `v5b`.

## Decision

- Query an envelope of ±0.001° (about 100 m) around the site, rounded to 3 decimal places. Any intersecting polygon means **bushfire-prone**, reported with the categories found. No polygon means **not mapped as bushfire-prone**.
- The answer is about land "within about 100 m". Buffers are 30–100 m wide, so this errs towards *prone*, which is the safe side.
- Results are **not cached**: the cache key would hold a location to about 100 m.
- Every answer says that the council's certified map and a Bushfire Attack Level (BAL) assessment are authoritative, and that this is not a planning certificate.

## Consequences

- `bushfire_status` can now set the `bushfire` or the no-bushfire strategy without asking the user.
- The site point leaves the server at about 100 m precision, which is coarser than the user's site but finer than the 1 km sent to ALA. `docs/privacy.md` records this.
- `portal.spatial.nsw.gov.au` joins `ALLOWED_HOSTS`.
