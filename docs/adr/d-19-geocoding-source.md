# D-19: Geocoding source — NSW Address Location Service

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-25
- Decided by: the maintainer (requested a decision row per data source)
- Source: [specification Section 2](../specification.md#2-decision-log), [Section 8](../specification.md#8-data-sources-and-external-apis)
- Requirement: FR-02

## Context and problem

`geocode` accepted only latitude and longitude. Section 8 listed "Nominatim (OpenStreetMap) or a state address service" as candidates. Release 1 is NSW only (D-02).

## Checked on 25 Nov 2026

- Dataset: [NSW Address Location Service](https://data.nsw.gov.au/data/dataset/1602c6c4-d396-4890-a031-388d83635b5a) on data.nsw. The organisation is the Department of Customer Service, and the CKAN licence is `cc-by`. The 2015 LPI information sheet says "Creative Commons Attribution 3.0 Australia", with the attribution "© Land and Property Information [Year]". Spatial Services is LPI's successor.
- Service: `https://maps.six.nsw.gov.au/services/public/Address_Location`. It is documented at `https://maps.six.nsw.gov.au/sws/AddressLocation.html`.
  - Parameters are `houseNumber`, `roadName` (required), `roadType`, `suburb` and/or `postCode`, and `projection`.
  - The response holds `addressResult.addresses[].addressPoint.centreX/centreY`. `coordRefSys` was `EPSG:4283` (GDA94) even when `EPSG:4326` was requested. GDA94 differs from WGS84 by about 1–2 m, which is below every precision used here.
- The source is NSW's authoritative address database (GURAS), so NSW addresses are better covered than in OpenStreetMap. Nominatim was not checked further.

## Decision

- `geocode` with a street address calls the NSW Address Location Service. Claude splits the user's address into the structured fields.
- Address lookups are **not cached**, and the address text is not logged.
- **Suburb or postcode only:** the NSW Administrative Boundaries Theme `Suburb` layer returns suburb centroids (tested on 25 Nov 2026). Its licence is not stated on data.nsw ("notspecified"), and the Spatial Services copyright page could not be read. TODO: confirm the licence before using it. Until then, a suburb-only query returns a data gap that asks for a street address or the current location.

## Consequences

- The street address leaves the server, going to a NSW Government service. `docs/privacy.md` records this.
- `maps.six.nsw.gov.au` joins `ALLOWED_HOSTS`.
