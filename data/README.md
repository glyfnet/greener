# Data files

| File | Holds | Status |
| --- | --- | --- |
| `question-bank.yaml` | The simple-mode question bank (spec Section 7.3). Compiled to JSON by `npm run build:index`. | Draft ranges (Q-15) |
| `cost-reference.csv` | Dated price ranges for materials (Section 7.7, FR-68). | **Started.** 2 rows from the Yass Area Network nurseries, checked 24 Nov 2026, and 2 rows from the Armidale Tree Group 2026 wholesale order form, checked 25 Nov 2026. TODO(Q-12): add Sydney and coast prices (see "Price sources to add"). |
| `native-nurseries.csv` | Native plant nurseries and plant stalls, used by `find_native_nurseries` for the plan's local resources (FR-20). | **Started.** 4 entries in Armidale and Uralla, checked 25 Nov 2026. TODO: add other regions. |
| `species-images.csv` | Links to Wikimedia Commons species photos, with creator and licence, used by `get_species_images` (FR-17, D-23). Add rows with `npm run images:record -- <scientific name>...`, then review them in Claude Code with `/review-species-images`, which checks each photo, licence and creator and approves only what you agree to. | **Started.** 16 rows from the Armidale Tree Group koala list, recorded 25 Nov 2026. None reviewed yet. |
| `declared-weeds.csv` | Declared weeds, used by `check_species` and `save_plan` to block planting (FR-24). | **Started.** 135 NSW WeedWise priority weeds from two regions: Greater Sydney (126, read on 24 Nov 2026 from https://weeds.dpi.nsw.gov.au/Region?Id=81) and the Northern Tablelands, which covers Armidale Regional, Glen Innes Severn, Inverell, Tenterfield, Uralla and Walcha (104, read on 25 Nov 2026 from https://weeds.dpi.nsw.gov.au/Region?Id=8). TODO: add the other NSW regions. |

## Rules

- Do not invent values. Every row needs a real `source` / `source_url` and an `as_of` date (CLAUDE.md rule 4).
- `cost-reference.csv` columns: `item,unit,low_aud,high_aud,region,source,as_of`. Ranges only, never a single value.
- `declared-weeds.csv` columns: `scientific_name,state,category,source_url,as_of`. Use the accepted ALA name.

As well as this list, the weed check blocks species that ALA records as introduced
or invasive (`stateInvasive`) near the site. See `docs/architecture.md`,
"Species checks".

## Native nursery notes

- Columns: `id,name,kind,town,council,lat,lon,coord_precision,mail_order,website,offers,visiting,source_url,as_of`. `kind` is `nursery` or `market_stall`.
- Each row's `source_url` is the page its details came from: the nursery's own site, or the Australian Plants Society (APS) listing.
- Coordinates come from the NSW Address Location Service (D-19, CC BY). `address` means the exact address of public premises (Armidale Tree Group, 80 Mann St). `town` means a street in the town centre, rounded to 2 decimal places: Beardy St for Armidale, King St for Uralla.
- A home-based business (Cool Natives Nursery) is listed by town only. Its street address, phone and email stay out of the repository; the APS listing has them.
- Leads still to check by hand:
  - Mole Station Native Nursery, west of Tenterfield. APS Armidale's 2026 stalls sell its plants, so it is trading, but its website (molestationnursery.com) was last updated in 2004 and now shows unrelated posts. The ANPSA directory lists it.
  - Field's Native Nursery, Uralla. It appears only in a business directory snippet; not confirmed.

## Declared weed list notes

- Source: NSW WeedWise, Department of Primary Industries and Regional Development. The WeedWise footer links the NSW Government copyright notice: "licensed under the Creative Commons Attribution 4.0 licence", with attribution "© State of New South Wales". Species names and legal duties are recorded as facts, with a link to each profile (Q-20).
- Two names are normalised: "Rubus fruticosus species aggregate" is stored as `Rubus fruticosus`, and "Hymenachne amplexicaulis and hybrids" as `Hymenachne amplexicaulis`.
- Rows named `<Genus> species` (for example `Cortaderia species`) block every species in that genus.
- Subspecies are matched exactly, so `Olea europaea subsp. cuspidata` (African olive) blocks African olive but not the edible olive. A plant whose subspecies is listed gets a warning instead.
- A species listed in both regions has one row, and its `category` joins the two regions' duties with ` | `. Its `as_of` is the earlier check date.
- The Northern Tablelands page gives subspecies without a rank (for example "Carduus nutans nutans"). They are stored with the rank the Greater Sydney rows use (`subsp.`, or `var.` for *Cylindropuntia fulgida* var. *mamillata*). Single-genus rows (for example "Salix", "Harrisia") are stored as `<Genus> species`. The note "Regional recommended measure for Central Tablelands from February 2020" after *Solanum sisymbriifolium* was dropped from the name.
- The checks apply every region's list across NSW. This is stricter than the law requires, but safe for planting. TODO: load each region's list and match it to the site's council area.

## Price sources to add (TODO, Q-12)

Web searches on 24 Nov 2026 found these council nursery price pages, but each refused automated reads (HTTP 403 or 404), so their prices are **not** in the table yet. Check them by hand before adding rows:

- Sutherland Shire Community Nursery: https://www.sutherlandshire.nsw.gov.au/your-environment/community-nursery
- Hawkesbury City Council nursery: https://www.hawkesbury.nsw.gov.au/your-spaces/nursery
- Randwick Community Nursery: https://www.randwick.nsw.gov.au/environment-and-sustainability/randwick-community-nursery/plants-we-stock
- Ku-ring-gai Wildflower Garden nursery stock list
