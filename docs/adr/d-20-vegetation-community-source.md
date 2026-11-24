# D-20: Vegetation community source — NSW State Vegetation Type Map (pre-clearing)

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-25
- Decided by: the maintainer (requested a decision row per data source)
- Source: [specification Section 2](../specification.md#2-decision-log), [Section 8](../specification.md#8-data-sources-and-external-apis)
- Requirement: FR-14

## Context and problem

FR-14 asks for the *pre-clearing* vegetation community. Section 8 listed "NVIS and state vegetation maps" as candidates. Knowing the original community tells the plan which local natives belong on the site, which is more precise than ALA records within 10 km.

## Checked on 25 Nov 2026

- Dataset: [NSW State Vegetation Type Map – SVTM (Pre-Clearing)](https://data.nsw.gov.au/data/dataset/nsw-state-vegetation-type-map-pre-clearing) on data.nsw. The CKAN licence is `cc-by`, and the publisher is the NSW Department of Climate Change, Energy, the Environment and Water. The extant map (`nsw-state-vegetation-type-map`) is also `cc-by`.
- Service: `https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/VIS/SVTM_NSW_1750_PCT/MapServer/identify`, layer 2 (`NSW_PlantCommunityType_5m`, a 5 m raster). The attributes used are `PCTID`, `PCTName`, `vegClass` and `vegForm`.
- Test points:
  - Hyde Park, Sydney: PCT 3262, *Sydney Turpentine Ironbark Forest*.
  - Katoomba escarpment (−33.733, 150.313): PCT 3692, *Upper Blue Mountains Moist Forest*. About 200 m away, at −33.7325, 150.3125, the result was PCT 3694, *Upper Blue Mountains Ridgetop Woodland*, which shows the map's fine detail.
- The fixtures are in `server/test/fixtures/vegetation/`.
- The extant map (`SVTM_NSW_Extant_PCT`) has no community at cleared urban sites, so it does not meet FR-14.

## Decision

- `vegetation_community` identifies the pre-clearing Plant Community Type at the site, rounded to 3 decimal places. Results are **not cached**.
- The answer calls this the *likely original* community, from a statewide model. It is not a site survey.

## Consequences

- Plans can name the original community and pick local natives that fit it.
- A later step could list each PCT's characteristic species from the BioNet Vegetation Classification. TODO: check that API and its licence as its own source.
- `mapprod3.environment.nsw.gov.au` joins `ALLOWED_HOSTS`.
