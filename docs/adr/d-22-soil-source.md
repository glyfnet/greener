# D-22: Soil source — Soil and Landscape Grid of Australia (TERN / CSIRO map services)

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-25
- Decided by: the maintainer (requested a decision row per data source)
- Source: [specification Section 2](../specification.md#2-decision-log), [Section 8](../specification.md#8-data-sources-and-external-apis)
- Requirement: FR-13

## Context and problem

FR-13 needs soil pH, texture and organic carbon. Section 8 listed the Soil and Landscape Grid of Australia (SLGA, TERN) as the candidate.

## Checked on 25 Nov 2026

- **Old API is gone:** the CSIRO ASRIS web API (`asris.csiro.au/ASRISApi`), which the R package `slga` uses, no longer resolves (NXDOMAIN).
- **Map services:** `https://soils.csiro.au/arcgis/rest/services/TERN/<ATTR>_ACLEP_AU_TRN_N/MapServer/identify` for these attributes:
  - `PHC`: pH in CaCl₂.
  - `CLY`: clay.
  - `SND`: sand.
  - `SOC`: organic carbon.
- **Layers:** layer 1 is the 0–5 cm estimate (`*_000_005_EV_*`) and layer 5 is the 5–15 cm estimate (`*_005_015_EV_*`). The value is in `attributes["Classify.Pixel Value"]`.
- **Hyde Park at 0–5 cm:** pH 4.56, clay 12.2, sand 62, organic carbon 3.43.
- **Licence:** the TERN catalogue records for the SLGA National Soil Attribute Maps (for example `990f19ad-d4e6-5e48-acd9-2446c8747506`) give CC BY 4.0. The service credits ACLEP, the state agencies, TERN and CSIRO.
- **Units:** the TERN record for organic carbon gives units of %. Clay and sand are mass fractions in %.
- TODO: confirm which SLGA release the `TRN_N` services serve, and whether its units match the Release 1 records.

## Decision

- `soil_properties` makes four identify calls, one per attribute, each returning the 0–5 cm and 5–15 cm estimates.
- Coordinates are rounded to 3 decimal places, and results are **not cached**.
- The output says these are modelled estimates on a 90 m grid. It also says the user's own soil answer and a simple jar or pH test on site come first.

## Consequences

- There are four requests per call. Each is small, a few hundred bytes.
- `soils.csiro.au` joins `ALLOWED_HOSTS`.
