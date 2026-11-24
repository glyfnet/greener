# D-21: Climate source — Open-Meteo Historical Weather API (closes Q-06)

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-25
- Decided by: the maintainer (requested a decision row per data source)
- Source: [specification Section 2](../specification.md#2-decision-log), [Section 8](../specification.md#8-data-sources-and-external-apis), Q-06
- Requirement: FR-12

## Context and problem

FR-12 needs temperature, rainfall and frost for the site. Q-06 asked whether to use BOM data or Open-Meteo, and to check the licence for each.

## Checked on 25 Nov 2026

- **Terms:** [open-meteo.com/en/terms](https://open-meteo.com/en/terms) says the free API is for non-commercial use only. The limits are fewer than 10,000 calls a day, 5,000 an hour and 600 a minute. Its examples of non-commercial use include "private or non-profit websites or apps that do not have subscriptions or advertising", and it says "voluntary donations, including contributions through a tip jar, are permitted". That matches D-16.
- **Licence:** [open-meteo.com/en/licence](https://open-meteo.com/en/licence) says API data are CC BY 4.0, with a link to Open-Meteo shown next to the data. The reanalysis comes from the Copernicus Climate Change Service (C3S).
- **Endpoint:** `https://archive-api.open-meteo.com/v1/archive` with `latitude`, `longitude`, `start_date=1991-01-01`, `end_date=2020-12-31`, `daily=temperature_2m_max,temperature_2m_min,precipitation_sum` and `timezone=Australia/Sydney`. It returned HTTP 200 with about 300 KB for 30 years.
- **BOM:** BOM climate statistics were not checked for a documented JSON API. Open-Meteo has a documented API and written terms.

## Decision

- `climate_normals` gets 30 years (1991–2020) of daily data and computes:
  - Monthly mean maximum and minimum temperature.
  - Mean monthly rainfall.
  - Mean days a year with a minimum at or below 0 °C and at or below 2 °C. These thresholds are stated in the output, not as a definition of "frost".
- Coordinates are rounded to 1 decimal place (about 11 km). The ERA5 grid is about 25 km, so rounding changes nothing, and the edge cache can be shared. Results are cached for 30 days.
- Each output cites Open-Meteo with a link, and names ERA5 / Copernicus C3S as the underlying data.

## Consequences

- Reanalysis on a 25 km grid smooths local frost hollows and coastal effects, and the output says so.
- The CPU cost is parsing about 300 KB of JSON per uncached call. Q-17 must confirm that this fits the free plan. If it doesn't, fall back to fewer years.
- Cloudflare egress IPs are shared, so the free-tier rate limit may be reached by other users of the same IPs. A `429` response becomes a data gap (NFR-07).
- `archive-api.open-meteo.com` joins `ALLOWED_HOSTS`.
