/**
 * Site strategies for constrained sites (FR-23).
 *
 * Apartments, rented sites and bushfire-prone land are accepted, and the
 * plan is shaped to fit them. Each strategy names the global KB items it
 * comes from, so the plan can cite them (FR-25). The guidance is a short
 * summary in our own words of those KB items; the KB holds the detail.
 */
import type { SiteProfile } from "./models.js";

export type StrategyId = "chemical_free" | "phase_out_sprays" | "small_space" | "removable" | "bushfire" | "bushfire_unknown";

export interface SiteStrategy {
  id: StrategyId;
  situation: string;
  summary: string;
  guidance: string[];
  /** Rules the plan should follow; save_plan warns when they are missed. */
  planRules: string[];
  /** Caution tag that actions should carry for this strategy. */
  cautionTag: "renter" | "bushfire" | "safety" | "other";
  citationIds: string[];
  /** Query for search_knowledge to get more detail. */
  searchQuery: string;
}

const SMALL_SITES = new Set(["apartment", "townhouse"]);

/** KB citation IDs used by the strategies. A unit test checks that each exists in the shipped index. */
export const STRATEGY_CITATIONS = {
  smallSpaces: "kb:nsw-sydney-nature-small-spaces",
  urbanHabitat: "kb:city-of-sydney-urban-habitat-guide",
  balconyGuide: "kb:greener-apartment-balcony-habitat#1",
  apzHabitat: "kb:rfs-habitat-in-apz-gardens",
  apzStandards: "kb:rfs-standards-asset-protection-zones",
  bushfireGuide: "kb:greener-bushfire-prone-habitat#1",
  weeds: "kb:nsw-weedwise-greater-sydney",
  chemicalFree: "kb:greener-chemical-free-rewilding#1",
  lantana: "kb:weedwise-lantana",
  groundAsparagus: "kb:weedwise-ground-asparagus",
} as const;

const C = STRATEGY_CITATIONS;

/** Strategies that apply to this site, from its answers. Pure and deterministic. */
export function siteStrategies(profile: SiteProfile): SiteStrategy[] {
  // D-17 applies to every site: Australian natives, no invasives, no chemicals.
  const out: SiteStrategy[] = [
    {
      id: "chemical_free",
      situation: "Every Greener plan (D-17)",
      summary: "Rewild with Australian natives (local natives first), never invasives, and no chemicals. Remove weeds by hand, keep coming back, and fill every gap with natives.",
      guidance: [
        "Plant Australian natives only, local ones first. check_species and save_plan block weeds, pests, species introduced near the site, and non-natives.",
        "Clear weeds a small section at a time, starting at the edge, and only as much as you can follow up.",
        "Hand pull after rain, dig out roots and crowns, and bag seeds, fruit and crowns.",
        "Recheck 1–3 months after clearing and again at 3–6 months. Pull seedlings while they are small.",
        "Replant or cover cleared ground straight away, so weeds don't return and the soil doesn't erode.",
        "Manage pests by exclusion (guards, netting, keeping cats in) and by habitat, never by baits or sprays.",
        "Use compost and leaf mulch, not synthetic fertiliser.",
      ],
      planRules: [
        "No action may use herbicide, pesticide, poison, bait, spray, fungicide or synthetic fertiliser. save_plan refuses it.",
        "Weed-control actions need follow-up upkeep hours (maintenanceHoursPerMonth).",
        "The replanting action for a cleared area should depend on its weed-control action.",
      ],
      cautionTag: "other",
      citationIds: [C.chemicalFree, C.lantana, C.groundAsparagus, C.weeds],
      searchQuery: "hand weeding physical removal crowning follow-up",
    },
  ];
  const site = profile.answers.site_type?.optionIds[0];
  const tenure = profile.answers.tenure?.optionIds[0];
  const fire = profile.answers.bushfire_prone;

  const sprays = profile.answers.sprays?.optionIds[0];
  if (sprays === "sometimes" || sprays === "often") {
    out.push({
      id: "phase_out_sprays",
      situation: sprays === "often" ? "Sprays are used often now" : "Sprays are used sometimes now",
      summary: "Stop spraying, starting with the areas you rewild first, and plan the hand work that replaces it.",
      guidance: [
        "Make a quick-win action to stop spraying in the first rewilding area.",
        "For each spray job, plan a hand method instead, and count its hours in the plan.",
        "Ask your council how to dispose of leftover chemicals safely. Do not pour them down drains or onto soil.",
      ],
      planRules: ["Add an early action that ends spraying, and give the replacement hand work realistic hours."],
      cautionTag: "other",
      citationIds: [C.chemicalFree],
      searchQuery: "chemical-free weed control",
    });
  }

  if (site && SMALL_SITES.has(site)) {
    out.push({
      id: "small_space",
      situation: site === "apartment" ? "Apartment or balcony" : "Townhouse or courtyard",
      summary: "Build habitat in pots, troughs and baskets: food, water and shelter in layers, all of it movable.",
      guidance: [
        "Plant local natives in lightweight pots, troughs and hanging baskets, with good potting mix.",
        "Match plants to the light: north-facing gets the most winter sun, west-facing gets harsh afternoon sun. Use hardy plants on windy balconies.",
        "Plant in layers: a small shrub, a climber on a trellis or mesh, and groundcovers or grasses.",
        "Add a shallow birdbath, kept clean and topped up, and an insect hotel.",
        "Use no poisons.",
        "Check the load the balcony can take, make sure water drains to the balcony drain, and fix pots so wind cannot move them.",
      ],
      planRules: [
        "Prefer pots, planters and freestanding items over in-ground work.",
        "Mark fixed works as permanent, and add a 'renter' caution about getting strata or landlord approval.",
        "Add a 'safety' caution to heavy planters, ponds and anything on a railing.",
      ],
      cautionTag: "safety",
      citationIds: [C.smallSpaces, C.urbanHabitat, C.balconyGuide],
      searchQuery: "balcony pots small spaces habitat",
    });
  }

  if (tenure === "rent" || tenure === "strata") {
    out.push({
      id: "removable",
      situation: tenure === "rent" ? "Rented site" : "Strata or shared site",
      summary: "Choose actions you can take with you, and get written approval before any fixed change.",
      guidance: [
        "Use pots, raised beds that sit on the ground, freestanding birdbaths and hanging insect hotels.",
        tenure === "rent" ? "Ask your landlord in writing before planting in the ground, removing plants or fixing anything to the building." : "Check the strata by-laws, and ask the committee before you change shared areas or fix anything to the building.",
        "Talk to your council about free plants and habitat programs for residents.",
      ],
      planRules: ["Any action with permanent: true needs a 'renter' caution that says who must approve it."],
      cautionTag: "renter",
      citationIds: [C.balconyGuide, C.urbanHabitat],
      searchQuery: "renter strata removable habitat",
    });
  }

  if (fire?.optionIds[0] === "yes") {
    out.push({
      id: "bushfire",
      situation: "Bushfire-prone land",
      summary: "Keep fuel low near buildings, and put habitat in small, separated havens well away from the house.",
      guidance: [
        "Keep an asset protection zone of low fuel around buildings. Follow your council's conditions and your Bush Fire Survival Plan first.",
        "Put habitat in a few small havens away from the house, separated by paths, gravel, lawn or low groundcover.",
        "Grade from tall plants furthest from the house to low plants near it. Nothing should touch the walls.",
        "In the zone, keep tree crowns 2–5 m apart, with no canopy over the house, and lift the lowest branches to 2 m.",
        "Near the house, use plants with large smooth leaves (for example Dianella, Lomandra). Keep eucalypts, melaleucas and tea-trees as single trees well away from it.",
        "Use rocks for lizard and insect shelter instead of deep mulch. Rake dead leaves and clear gutters before each fire season.",
      ],
      planRules: [
        "Every planting and habitat action needs a 'bushfire' caution that says where it goes relative to the house.",
        "Add the yearly fire-season clean-up as upkeep hours (maintenanceHoursPerMonth).",
      ],
      cautionTag: "bushfire",
      citationIds: [C.apzHabitat, C.apzStandards, C.bushfireGuide],
      searchQuery: "bushfire asset protection zone habitat garden",
    });
  } else if (fire?.notSure) {
    out.push({
      id: "bushfire_unknown",
      situation: "Bushfire-prone status not known",
      summary: "Check the council's bushfire-prone land map. Until then, plan as if the site were bushfire-prone.",
      guidance: [
        "Ask your council, or check its bushfire-prone land map.",
        "Meanwhile, keep dense planting and oily trees away from buildings, and keep leaf litter low near the house.",
      ],
      planRules: ["Add a 'bushfire' caution to planting and habitat actions near buildings."],
      cautionTag: "bushfire",
      citationIds: [C.apzHabitat, C.bushfireGuide],
      searchQuery: "bushfire prone land habitat garden",
    });
  }
  return out;
}
