# Tool reference

Generated from the Zod schemas in `server/src/tools/` by `npm run docs:tools`. Do not edit by hand: `npm run check` fails when this file is out of date.

The server is stateless (D-09): tools that need site data take it as input, and `save_*` tools return the validated data for Claude to save in the user's Project.

| Tool | What it does |
| --- | --- |
| [`get_question_bank`](#get_question_bank) | Get question bank |
| [`ask_question`](#ask_question) | Ask a question |
| [`save_answer`](#save_answer) | Save an answer |
| [`geocode`](#geocode) | Find site coordinates |
| [`bushfire_status`](#bushfire_status) | Look up bushfire-prone land |
| [`save_profile`](#save_profile) | Check and save the site profile |
| [`get_site`](#get_site) | Summarise a site file |
| [`ala_species_near`](#ala_species_near) | Find species near the site |
| [`ala_species_profile`](#ala_species_profile) | Get a species profile |
| [`climate_normals`](#climate_normals) | Get climate normals |
| [`soil_properties`](#soil_properties) | Get soil properties |
| [`vegetation_community`](#vegetation_community) | Get the pre-clearing vegetation community |
| [`weed_status`](#weed_status) | Check declared weed status |
| [`save_research`](#save_research) | Check and save the research report |
| [`search_knowledge`](#search_knowledge) | Search the global knowledge base |
| [`get_site_strategies`](#get_site_strategies) | Get strategies for this site |
| [`check_species`](#check_species) | Check species for planting |
| [`get_cost_reference`](#get_cost_reference) | Get cost estimates |
| [`find_native_nurseries`](#find_native_nurseries) | Find native plant nurseries |
| [`schedule_plan`](#schedule_plan) | Put actions into phases |
| [`mark_done`](#mark_done) | Mark an action done |
| [`save_plan`](#save_plan) | Check and save the plan |
| [`export_plan`](#export_plan) | Export the plan |
| [`search_site`](#search_site) | Search the site file |
| [`get_plan_section`](#get_plan_section) | Get one part of the plan |

## get_question_bank

Get the site questions, their options and the skip logic. Use at the start of an intake. Pass the profile so far to get only the questions that apply to this site (FR-10b).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "description": "The site profile so far. Omit to start a new site.",
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    }
  }
}
```

## ask_question

Show one intake question as a card with buttons (MCP App). Hosts without MCP Apps get a numbered list in the text (FR-09). Omit questionId to get the next unanswered question; skipIds lists questions the user skipped for now.

UI resource: `ui://intake-card`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "description": "The site profile so far. Omit to start a new site.",
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "questionId": {
      "type": "string"
    },
    "skipIds": {
      "default": [],
      "maxItems": 30,
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

## save_answer

Save one answer and get the next question. Use it when the user answers in chat; while a question card is open, the card calls it itself. Also use it to change one answer later without repeating the questionnaire (FR-06). Returns the updated profile: keep it and pass it to the next call.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "description": "The site profile so far. Omit to start a new site.",
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "questionId": {
      "type": "string",
      "minLength": 1
    },
    "answer": {
      "type": "object",
      "properties": {
        "optionIds": {
          "default": [],
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "other": {
          "description": "Free text from the Other option",
          "type": "string",
          "maxLength": 500
        },
        "notSure": {
          "type": "boolean"
        }
      }
    },
    "location": {
      "description": "Only for the location question",
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    }
  },
  "required": [
    "questionId",
    "answer"
  ]
}
```

## geocode

Turn the user's location into site coordinates (FR-02). Pass lat and lon from the user's current location or typed coordinates. For a NSW street address, split it into `address` fields (roadName, and suburb or postCode, are needed); it is looked up in the NSW Address Location Service (D-19). Suburb-only or postcode-only lookup is not available yet; the result says so.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "lat": {
      "type": "number"
    },
    "lon": {
      "type": "number"
    },
    "address": {
      "type": "object",
      "properties": {
        "houseNumber": {
          "description": "House number, e.g. '12' or '12A'",
          "type": "string",
          "maxLength": 20
        },
        "roadName": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80,
          "description": "Road name without the type, e.g. 'Panorama'"
        },
        "roadType": {
          "description": "Road type, full or short, e.g. 'Avenue' or 'Ave'",
          "type": "string",
          "maxLength": 30
        },
        "suburb": {
          "type": "string",
          "maxLength": 80
        },
        "postCode": {
          "type": "string",
          "pattern": "^\\d{4}$"
        }
      },
      "required": [
        "roadName"
      ]
    },
    "query": {
      "description": "Suburb or postcode, when there is no street address",
      "type": "string",
      "maxLength": 200
    },
    "label": {
      "type": "string",
      "maxLength": 200
    }
  }
}
```

## bushfire_status

Look up whether the site is on NSW bushfire-prone land (FR-03, D-18), from the NSW RFS Bush Fire Prone Land map. Use when the user answered Not sure, or to check their answer. Checks land within about 100 m of the site. Returns a suggested answer for the bushfire_prone question and a citation. The council's certified map is authoritative.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    }
  },
  "required": [
    "location"
  ]
}
```

## save_profile

Validate the full site profile against the schema and the question bank. Use at the end of the intake, or to load answers from a JSON or YAML file the user gave (FR-05). On success, save the returned profile as profile.json in the user's Project. The server keeps nothing (D-09).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "description": "The whole site profile"
    }
  },
  "required": [
    "profile"
  ]
}
```

## get_site

Summarise the user's saved site file: answers, capacity, data gaps and what is still missing. Use at the start of research, planning or a question, after reading profile.json from the user's Project.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    }
  },
  "required": [
    "profile"
  ]
}
```

## ala_species_near

Get species recorded by the Atlas of Living Australia within a radius of the site (default 10 km, FR-10). Returns native plants, introduced plants, animals, threatened species and state-flagged invasive species as short lists with counts and citation IDs (FR-11). A failed query becomes a data gap; the rest still returns (NFR-07).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    },
    "radiusKm": {
      "default": 10,
      "type": "number",
      "minimum": 1,
      "maximum": 50
    }
  },
  "required": [
    "location"
  ]
}
```

## ala_species_profile

Get the accepted ALA name, common name, family and status for one species (FR-33, NFR-01). Use for key species in the report, and for species the user asks about that are not in the site data.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 2,
      "maxLength": 120,
      "description": "Scientific or common name"
    }
  },
  "required": [
    "name"
  ]
}
```

## climate_normals

Get 1991–2020 climate normals for the site from the Open-Meteo Historical Weather API (FR-12, D-21): monthly mean maximum and minimum temperature, monthly and annual rainfall, and mean nights a year at or below 0 °C and 2 °C. Use them to time planting and choose natives suited to the site. The grid is about 25 km, so local effects are smoothed out.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    }
  },
  "required": [
    "location"
  ]
}
```

## soil_properties

Get modelled soil pH (CaCl₂), clay, sand and organic carbon at 0–5 cm and 5–15 cm for the site, from the Soil and Landscape Grid of Australia (FR-13, D-22). These are estimates on a 90 m grid: the user's own soil answer and a simple test on site come first.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    }
  },
  "required": [
    "location"
  ]
}
```

## vegetation_community

Get the likely original (pre-clearing) Plant Community Type for the site from the NSW State Vegetation Type Map (FR-14, D-20). Use it to choose local natives that belong in that community, and to explain the plan. It is a statewide model, not a site survey.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    }
  },
  "required": [
    "location"
  ]
}
```

## weed_status

Check species names against the state declared weed list (FR-11, FR-24). Use for invasive species in the report and for any species the user asks about. Says clearly when the list has no data yet.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "names": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 2
      }
    },
    "state": {
      "default": "NSW",
      "type": "string",
      "const": "NSW"
    }
  },
  "required": [
    "names"
  ]
}
```

## save_research

Validate the research report (FR-15) against its schema. Every species must cite a citation in the report. On success, save the returned report as research.json in the user's Project. The server keeps nothing (D-09).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "research": {}
  },
  "required": [
    "research"
  ]
}
```

## search_knowledge

Keyword search of the global Greener knowledge base (FR-44). Returns up to 8 passages with citation IDs. For link-catalogue results, read the live page at the URL with web fetch and cite it (FR-46). Search the user's own Project files yourself as well: the local KB never goes to the server (FR-43).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "minLength": 2,
      "maxLength": 300
    },
    "region": {
      "description": "e.g. 'NSW'. Items for all of Australia always match.",
      "type": "string",
      "maxLength": 60
    },
    "tier": {
      "type": "string",
      "enum": [
        "open_content",
        "link_catalogue"
      ]
    },
    "limit": {
      "default": 8,
      "type": "integer",
      "minimum": 1,
      "maximum": 8
    }
  },
  "required": [
    "query"
  ]
}
```

## get_site_strategies

Get planning strategies for sites with special constraints: apartments and courtyards, rented or strata sites, and bushfire-prone land (FR-23). Use before drafting actions. Each strategy has guidance, rules for the plan, the caution tag to use, and citations to copy into the plan.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "profile": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    }
  },
  "required": [
    "profile"
  ]
}
```

## check_species

Check candidate planting species before they go in a plan (FR-22, FR-24, NFR-01, D-17). Resolves each name to the ALA taxonomy, checks it against the site research and the declared weed list, and asks ALA about species the research does not cover. Australian natives are allowed (local natives are best); invasives are blocked: priority weeds, state-flagged pests, and anything recorded as introduced near the site. Copy the returned citations into the plan.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "names": {
      "minItems": 1,
      "maxItems": 40,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 2
      }
    },
    "research": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "radiusKm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 50
        },
        "keyNativePlants": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "keyFauna": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "threatenedSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "invasiveSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "climateSummary": {
          "type": "string"
        },
        "soilSummary": {
          "type": "string"
        },
        "vegetationCommunity": {
          "type": "string"
        },
        "dataGaps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "createdAt",
        "radiusKm",
        "keyNativePlants",
        "keyFauna",
        "threatenedSpecies",
        "invasiveSpecies",
        "dataGaps",
        "citations"
      ]
    },
    "location": {
      "description": "Site location; needed to check species that are not in the research report",
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    }
  },
  "required": [
    "names",
    "research"
  ]
}
```

## get_cost_reference

Get dated cost ranges (AUD) for materials (FR-68). The user's local prices win over the reference table (FR-69). Items with no data come back as 'no data': do not invent a price for them (FR-70).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "items": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "region": {
      "type": "string"
    },
    "localPrices": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": {
            "type": "string",
            "minLength": 1
          },
          "unit": {
            "type": "string",
            "minLength": 1
          },
          "lowAud": {
            "type": "number",
            "minimum": 0
          },
          "highAud": {
            "type": "number",
            "minimum": 0
          },
          "asOf": {
            "type": "string",
            "minLength": 1
          },
          "note": {
            "type": "string"
          }
        },
        "required": [
          "item",
          "unit",
          "lowAud",
          "highAud",
          "asOf"
        ]
      }
    }
  },
  "required": [
    "items"
  ]
}
```

## find_native_nurseries

Find nurseries and plant stalls that specialise in Australian native plants near the site (FR-20 local resources, D-17). Returns name, town, distance, what they offer, how to visit, a website and a citation for each. Add the ones the user may use to the plan's localResources. The directory is small and growing; it says when there is nothing nearby.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "location": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "minimum": -44,
          "maximum": -10,
          "description": "Latitude, Australia only (D-02)"
        },
        "lon": {
          "type": "number",
          "minimum": 112,
          "maximum": 154,
          "description": "Longitude, Australia only (D-02)"
        },
        "label": {
          "description": "Suburb or place name the user gave",
          "type": "string",
          "maxLength": 200
        },
        "precision": {
          "default": "approximate",
          "type": "string",
          "enum": [
            "exact",
            "approximate"
          ]
        },
        "state": {
          "default": "NSW",
          "description": "MVP covers NSW only (D-02)",
          "type": "string",
          "const": "NSW"
        }
      },
      "required": [
        "lat",
        "lon"
      ]
    },
    "radiusKm": {
      "default": 100,
      "type": "number",
      "minimum": 5,
      "maximum": 300
    }
  },
  "required": [
    "location"
  ]
}
```

## schedule_plan

Put plan actions into phases that fit the user's hours and budget (Section 7.7, FR-63–FR-67). Give the actions with estimates, and either the profile or the capacity. Returns phases, a budget table, deferred actions with reasons, and what more time or money would add. Do this with the tool, not by judgment.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "actions": {
      "minItems": 1,
      "maxItems": 200,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 40
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "category": {
            "type": "string",
            "enum": [
              "weed_control",
              "soil",
              "planting",
              "water",
              "habitat_structure",
              "pest_animal",
              "monitoring",
              "other"
            ]
          },
          "priority": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ]
          },
          "effort": {
            "type": "string",
            "enum": [
              "low",
              "medium",
              "high"
            ]
          },
          "season": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            }
          },
          "steps": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "targetSpecies": {
            "default": [],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "rationale": {
            "type": "string",
            "minLength": 1
          },
          "cautions": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "tag": {
                  "type": "string",
                  "enum": [
                    "bushfire",
                    "renter",
                    "council",
                    "pets",
                    "safety",
                    "other"
                  ]
                },
                "text": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "tag",
                "text"
              ]
            }
          },
          "citationIds": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "labourHours": {
            "type": "object",
            "properties": {
              "low": {
                "type": "number",
                "minimum": 0
              },
              "high": {
                "type": "number",
                "minimum": 0
              }
            },
            "required": [
              "low",
              "high"
            ]
          },
          "materialsAud": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "low": {
                    "type": "number",
                    "minimum": 0
                  },
                  "high": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "low",
                  "high"
                ]
              },
              {
                "type": "null"
              }
            ],
            "description": "null when there is no cost data (FR-70)"
          },
          "costAsOf": {
            "description": "Date of the cost reference used (FR-68)",
            "type": "string"
          },
          "window": {
            "type": "object",
            "properties": {
              "startMonth": {
                "type": "integer",
                "minimum": 1,
                "maximum": 12
              },
              "endMonth": {
                "type": "integer",
                "minimum": 1,
                "maximum": 12
              }
            },
            "required": [
              "startMonth",
              "endMonth"
            ]
          },
          "dependsOn": {
            "default": [],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "maintenanceHoursPerMonth": {
            "default": 0,
            "type": "number",
            "minimum": 0
          },
          "benefit": {
            "default": 3,
            "description": "Relative benefit, used to rank by benefit per hour",
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "permanent": {
            "default": false,
            "description": "True for fixed works a renter may need permission for",
            "type": "boolean"
          },
          "plantings": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "scientificName": {
                  "type": "string",
                  "minLength": 1
                },
                "commonName": {
                  "type": "string"
                },
                "quantity": {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991
                },
                "citationIds": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "scientificName",
                "citationIds"
              ]
            }
          },
          "done": {
            "description": "Set by mark_done (FR-71): month index in the plan and actual effort",
            "type": "object",
            "properties": {
              "month": {
                "type": "integer",
                "minimum": 1,
                "maximum": 36
              },
              "hours": {
                "type": "number",
                "minimum": 0
              },
              "costAud": {
                "type": "number",
                "minimum": 0
              }
            },
            "required": [
              "month",
              "hours",
              "costAud"
            ]
          }
        },
        "required": [
          "id",
          "title",
          "category",
          "priority",
          "effort",
          "season",
          "steps",
          "rationale",
          "citationIds",
          "labourHours",
          "materialsAud",
          "window"
        ]
      }
    },
    "startMonth": {
      "type": "integer",
      "minimum": 1,
      "maximum": 12,
      "description": "Calendar month the plan starts (1 = January)"
    },
    "profile": {
      "description": "Site profile: capacity is read from its answers",
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "capacity": {
      "description": "Capacity given directly; overrides the profile",
      "type": "object",
      "properties": {
        "hoursPerWeek": {
          "type": "object",
          "properties": {
            "summer": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            },
            "autumn": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            },
            "winter": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            },
            "spring": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            }
          },
          "required": [
            "summer",
            "autumn",
            "winter",
            "spring"
          ]
        },
        "upfrontAud": {
          "type": "number",
          "minimum": 0
        },
        "yearlyAud": {
          "type": "number",
          "minimum": 0
        }
      },
      "required": [
        "hoursPerWeek",
        "upfrontAud",
        "yearlyAud"
      ]
    },
    "includeMonthly": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "actions",
    "startMonth"
  ]
}
```

## mark_done

Mark one action as done with its actual hours and cost, and reschedule the rest (FR-71). Save the returned actions back into the plan.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "actions": {
      "minItems": 1,
      "maxItems": 200,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 40
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "category": {
            "type": "string",
            "enum": [
              "weed_control",
              "soil",
              "planting",
              "water",
              "habitat_structure",
              "pest_animal",
              "monitoring",
              "other"
            ]
          },
          "priority": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ]
          },
          "effort": {
            "type": "string",
            "enum": [
              "low",
              "medium",
              "high"
            ]
          },
          "season": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            }
          },
          "steps": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "targetSpecies": {
            "default": [],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "rationale": {
            "type": "string",
            "minLength": 1
          },
          "cautions": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "tag": {
                  "type": "string",
                  "enum": [
                    "bushfire",
                    "renter",
                    "council",
                    "pets",
                    "safety",
                    "other"
                  ]
                },
                "text": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "tag",
                "text"
              ]
            }
          },
          "citationIds": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "labourHours": {
            "type": "object",
            "properties": {
              "low": {
                "type": "number",
                "minimum": 0
              },
              "high": {
                "type": "number",
                "minimum": 0
              }
            },
            "required": [
              "low",
              "high"
            ]
          },
          "materialsAud": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "low": {
                    "type": "number",
                    "minimum": 0
                  },
                  "high": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "low",
                  "high"
                ]
              },
              {
                "type": "null"
              }
            ],
            "description": "null when there is no cost data (FR-70)"
          },
          "costAsOf": {
            "description": "Date of the cost reference used (FR-68)",
            "type": "string"
          },
          "window": {
            "type": "object",
            "properties": {
              "startMonth": {
                "type": "integer",
                "minimum": 1,
                "maximum": 12
              },
              "endMonth": {
                "type": "integer",
                "minimum": 1,
                "maximum": 12
              }
            },
            "required": [
              "startMonth",
              "endMonth"
            ]
          },
          "dependsOn": {
            "default": [],
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "maintenanceHoursPerMonth": {
            "default": 0,
            "type": "number",
            "minimum": 0
          },
          "benefit": {
            "default": 3,
            "description": "Relative benefit, used to rank by benefit per hour",
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "permanent": {
            "default": false,
            "description": "True for fixed works a renter may need permission for",
            "type": "boolean"
          },
          "plantings": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "scientificName": {
                  "type": "string",
                  "minLength": 1
                },
                "commonName": {
                  "type": "string"
                },
                "quantity": {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991
                },
                "citationIds": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "scientificName",
                "citationIds"
              ]
            }
          },
          "done": {
            "description": "Set by mark_done (FR-71): month index in the plan and actual effort",
            "type": "object",
            "properties": {
              "month": {
                "type": "integer",
                "minimum": 1,
                "maximum": 36
              },
              "hours": {
                "type": "number",
                "minimum": 0
              },
              "costAud": {
                "type": "number",
                "minimum": 0
              }
            },
            "required": [
              "month",
              "hours",
              "costAud"
            ]
          }
        },
        "required": [
          "id",
          "title",
          "category",
          "priority",
          "effort",
          "season",
          "steps",
          "rationale",
          "citationIds",
          "labourHours",
          "materialsAud",
          "window"
        ]
      }
    },
    "actionId": {
      "type": "string",
      "minLength": 1
    },
    "month": {
      "type": "integer",
      "minimum": 1,
      "maximum": 36,
      "description": "Plan month the action was finished in (1 = first month)"
    },
    "actualHours": {
      "type": "number",
      "minimum": 0
    },
    "actualCostAud": {
      "type": "number",
      "minimum": 0
    },
    "startMonth": {
      "type": "integer",
      "minimum": 1,
      "maximum": 12,
      "description": "Calendar month the plan starts (1 = January)"
    },
    "profile": {
      "description": "Site profile: capacity is read from its answers",
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "capacity": {
      "description": "Capacity given directly; overrides the profile",
      "type": "object",
      "properties": {
        "hoursPerWeek": {
          "type": "object",
          "properties": {
            "summer": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            },
            "autumn": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            },
            "winter": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            },
            "spring": {
              "type": "number",
              "minimum": 0,
              "maximum": 80
            }
          },
          "required": [
            "summer",
            "autumn",
            "winter",
            "spring"
          ]
        },
        "upfrontAud": {
          "type": "number",
          "minimum": 0
        },
        "yearlyAud": {
          "type": "number",
          "minimum": 0
        }
      },
      "required": [
        "hoursPerWeek",
        "upfrontAud",
        "yearlyAud"
      ]
    }
  },
  "required": [
    "actions",
    "actionId",
    "month",
    "actualHours",
    "actualCostAud",
    "startMonth"
  ]
}
```

## save_plan

Validate the plan against its schema, then run the native-species, weed, citation and site-constraint checks (FR-22–FR-25). Refuses a plan that plants a weed or has broken citations; fix the listed items and call again. Apartment, rented and bushfire-prone sites are accepted: missing cautions come back as warnings with the strategy that fixes them. On success, save the plan as plans/v<version>.json and export it as Markdown.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "plan": {},
    "research": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "radiusKm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 50
        },
        "keyNativePlants": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "keyFauna": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "threatenedSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "invasiveSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "climateSummary": {
          "type": "string"
        },
        "soilSummary": {
          "type": "string"
        },
        "vegetationCommunity": {
          "type": "string"
        },
        "dataGaps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "createdAt",
        "radiusKm",
        "keyNativePlants",
        "keyFauna",
        "threatenedSpecies",
        "invasiveSpecies",
        "dataGaps",
        "citations"
      ]
    },
    "profile": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "startMonth": {
      "type": "integer",
      "minimum": 1,
      "maximum": 12,
      "description": "Calendar month the plan starts (1 = January)"
    }
  },
  "required": [
    "plan",
    "research",
    "profile"
  ]
}
```

## export_plan

Export a saved plan as Markdown or JSON (FR-50), with sources and attribution (NFR-17). Pass startMonth and the profile to include phases and the budget table.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "plan": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "version": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "goals": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "quickWins": {
          "default": [],
          "description": "Action IDs",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "actions": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "maxLength": 40
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "category": {
                "type": "string",
                "enum": [
                  "weed_control",
                  "soil",
                  "planting",
                  "water",
                  "habitat_structure",
                  "pest_animal",
                  "monitoring",
                  "other"
                ]
              },
              "priority": {
                "type": "string",
                "enum": [
                  "high",
                  "medium",
                  "low"
                ]
              },
              "effort": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ]
              },
              "season": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "summer",
                    "autumn",
                    "winter",
                    "spring"
                  ]
                }
              },
              "steps": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "targetSpecies": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "rationale": {
                "type": "string",
                "minLength": 1
              },
              "cautions": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "tag": {
                      "type": "string",
                      "enum": [
                        "bushfire",
                        "renter",
                        "council",
                        "pets",
                        "safety",
                        "other"
                      ]
                    },
                    "text": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "tag",
                    "text"
                  ]
                }
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "labourHours": {
                "type": "object",
                "properties": {
                  "low": {
                    "type": "number",
                    "minimum": 0
                  },
                  "high": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "low",
                  "high"
                ]
              },
              "materialsAud": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "low": {
                        "type": "number",
                        "minimum": 0
                      },
                      "high": {
                        "type": "number",
                        "minimum": 0
                      }
                    },
                    "required": [
                      "low",
                      "high"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ],
                "description": "null when there is no cost data (FR-70)"
              },
              "costAsOf": {
                "description": "Date of the cost reference used (FR-68)",
                "type": "string"
              },
              "window": {
                "type": "object",
                "properties": {
                  "startMonth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 12
                  },
                  "endMonth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 12
                  }
                },
                "required": [
                  "startMonth",
                  "endMonth"
                ]
              },
              "dependsOn": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "maintenanceHoursPerMonth": {
                "default": 0,
                "type": "number",
                "minimum": 0
              },
              "benefit": {
                "default": 3,
                "description": "Relative benefit, used to rank by benefit per hour",
                "type": "integer",
                "minimum": 1,
                "maximum": 5
              },
              "permanent": {
                "default": false,
                "description": "True for fixed works a renter may need permission for",
                "type": "boolean"
              },
              "plantings": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "scientificName": {
                      "type": "string",
                      "minLength": 1
                    },
                    "commonName": {
                      "type": "string"
                    },
                    "quantity": {
                      "type": "integer",
                      "exclusiveMinimum": 0,
                      "maximum": 9007199254740991
                    },
                    "citationIds": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "scientificName",
                    "citationIds"
                  ]
                }
              },
              "done": {
                "description": "Set by mark_done (FR-71): month index in the plan and actual effort",
                "type": "object",
                "properties": {
                  "month": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 36
                  },
                  "hours": {
                    "type": "number",
                    "minimum": 0
                  },
                  "costAud": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "month",
                  "hours",
                  "costAud"
                ]
              }
            },
            "required": [
              "id",
              "title",
              "category",
              "priority",
              "effort",
              "season",
              "steps",
              "rationale",
              "citationIds",
              "labourHours",
              "materialsAud",
              "window"
            ]
          }
        },
        "plantingList": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "quantity": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "citationIds"
            ]
          }
        },
        "monitoring": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "localResources": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string"
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "citationId": {
                "type": "string"
              }
            },
            "required": [
              "title",
              "citationId"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "version",
        "createdAt",
        "goals",
        "actions",
        "monitoring",
        "citations"
      ]
    },
    "format": {
      "default": "markdown",
      "type": "string",
      "enum": [
        "markdown",
        "json"
      ]
    },
    "research": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "radiusKm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 50
        },
        "keyNativePlants": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "keyFauna": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "threatenedSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "invasiveSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "climateSummary": {
          "type": "string"
        },
        "soilSummary": {
          "type": "string"
        },
        "vegetationCommunity": {
          "type": "string"
        },
        "dataGaps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "createdAt",
        "radiusKm",
        "keyNativePlants",
        "keyFauna",
        "threatenedSpecies",
        "invasiveSpecies",
        "dataGaps",
        "citations"
      ]
    },
    "profile": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "startMonth": {
      "type": "integer",
      "minimum": 1,
      "maximum": 12,
      "description": "Calendar month the plan starts (1 = January)"
    }
  },
  "required": [
    "plan"
  ]
}
```

## search_site

Search the user's own site data (profile, research and plan) for a question (FR-30). Pass the parts of the site file you have. Results carry citation IDs to keep in the answer (FR-31).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "minLength": 2,
      "maxLength": 300
    },
    "profile": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "mode": {
          "default": "simple",
          "type": "string",
          "enum": [
            "simple",
            "detailed"
          ]
        },
        "location": {
          "type": "object",
          "properties": {
            "lat": {
              "type": "number",
              "minimum": -44,
              "maximum": -10,
              "description": "Latitude, Australia only (D-02)"
            },
            "lon": {
              "type": "number",
              "minimum": 112,
              "maximum": 154,
              "description": "Longitude, Australia only (D-02)"
            },
            "label": {
              "description": "Suburb or place name the user gave",
              "type": "string",
              "maxLength": 200
            },
            "precision": {
              "default": "approximate",
              "type": "string",
              "enum": [
                "exact",
                "approximate"
              ]
            },
            "state": {
              "default": "NSW",
              "description": "MVP covers NSW only (D-02)",
              "type": "string",
              "const": "NSW"
            }
          },
          "required": [
            "lat",
            "lon"
          ]
        },
        "answers": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "optionIds": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "other": {
                "description": "Free text from the Other option",
                "type": "string",
                "maxLength": 500
              },
              "notSure": {
                "type": "boolean"
              }
            }
          }
        },
        "detailed": {
          "type": "object",
          "properties": {
            "hoursPerWeekBySeason": {
              "type": "object",
              "properties": {
                "summer": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "autumn": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "winter": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                },
                "spring": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 80
                }
              },
              "required": [
                "summer",
                "autumn",
                "winter",
                "spring"
              ]
            },
            "upfrontBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "yearlyBudgetAud": {
              "type": "number",
              "minimum": 0
            },
            "areaM2": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "localPrices": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "item": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "lowAud": {
                "type": "number",
                "minimum": 0
              },
              "highAud": {
                "type": "number",
                "minimum": 0
              },
              "asOf": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "item",
              "unit",
              "lowAud",
              "highAud",
              "asOf"
            ]
          }
        },
        "dataGaps": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        }
      }
    },
    "research": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "radiusKm": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 50
        },
        "keyNativePlants": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "keyFauna": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "threatenedSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "invasiveSpecies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "kingdom": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "native",
                    "introduced",
                    "threatened",
                    "declared_weed",
                    "biosecurity_pest"
                  ]
                }
              },
              "recordCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "tags",
              "citationIds"
            ]
          }
        },
        "climateSummary": {
          "type": "string"
        },
        "soilSummary": {
          "type": "string"
        },
        "vegetationCommunity": {
          "type": "string"
        },
        "dataGaps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string",
                "minLength": 1
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "topic",
              "reason"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "createdAt",
        "radiusKm",
        "keyNativePlants",
        "keyFauna",
        "threatenedSpecies",
        "invasiveSpecies",
        "dataGaps",
        "citations"
      ]
    },
    "plan": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "version": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "goals": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "quickWins": {
          "default": [],
          "description": "Action IDs",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "actions": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "maxLength": 40
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "category": {
                "type": "string",
                "enum": [
                  "weed_control",
                  "soil",
                  "planting",
                  "water",
                  "habitat_structure",
                  "pest_animal",
                  "monitoring",
                  "other"
                ]
              },
              "priority": {
                "type": "string",
                "enum": [
                  "high",
                  "medium",
                  "low"
                ]
              },
              "effort": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ]
              },
              "season": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "summer",
                    "autumn",
                    "winter",
                    "spring"
                  ]
                }
              },
              "steps": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "targetSpecies": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "rationale": {
                "type": "string",
                "minLength": 1
              },
              "cautions": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "tag": {
                      "type": "string",
                      "enum": [
                        "bushfire",
                        "renter",
                        "council",
                        "pets",
                        "safety",
                        "other"
                      ]
                    },
                    "text": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "tag",
                    "text"
                  ]
                }
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "labourHours": {
                "type": "object",
                "properties": {
                  "low": {
                    "type": "number",
                    "minimum": 0
                  },
                  "high": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "low",
                  "high"
                ]
              },
              "materialsAud": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "low": {
                        "type": "number",
                        "minimum": 0
                      },
                      "high": {
                        "type": "number",
                        "minimum": 0
                      }
                    },
                    "required": [
                      "low",
                      "high"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ],
                "description": "null when there is no cost data (FR-70)"
              },
              "costAsOf": {
                "description": "Date of the cost reference used (FR-68)",
                "type": "string"
              },
              "window": {
                "type": "object",
                "properties": {
                  "startMonth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 12
                  },
                  "endMonth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 12
                  }
                },
                "required": [
                  "startMonth",
                  "endMonth"
                ]
              },
              "dependsOn": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "maintenanceHoursPerMonth": {
                "default": 0,
                "type": "number",
                "minimum": 0
              },
              "benefit": {
                "default": 3,
                "description": "Relative benefit, used to rank by benefit per hour",
                "type": "integer",
                "minimum": 1,
                "maximum": 5
              },
              "permanent": {
                "default": false,
                "description": "True for fixed works a renter may need permission for",
                "type": "boolean"
              },
              "plantings": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "scientificName": {
                      "type": "string",
                      "minLength": 1
                    },
                    "commonName": {
                      "type": "string"
                    },
                    "quantity": {
                      "type": "integer",
                      "exclusiveMinimum": 0,
                      "maximum": 9007199254740991
                    },
                    "citationIds": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "scientificName",
                    "citationIds"
                  ]
                }
              },
              "done": {
                "description": "Set by mark_done (FR-71): month index in the plan and actual effort",
                "type": "object",
                "properties": {
                  "month": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 36
                  },
                  "hours": {
                    "type": "number",
                    "minimum": 0
                  },
                  "costAud": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "month",
                  "hours",
                  "costAud"
                ]
              }
            },
            "required": [
              "id",
              "title",
              "category",
              "priority",
              "effort",
              "season",
              "steps",
              "rationale",
              "citationIds",
              "labourHours",
              "materialsAud",
              "window"
            ]
          }
        },
        "plantingList": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "quantity": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "citationIds"
            ]
          }
        },
        "monitoring": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "localResources": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string"
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "citationId": {
                "type": "string"
              }
            },
            "required": [
              "title",
              "citationId"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "version",
        "createdAt",
        "goals",
        "actions",
        "monitoring",
        "citations"
      ]
    }
  },
  "required": [
    "query"
  ]
}
```

## get_plan_section

Get one section of a plan, or one action by ID. Use to answer a question about the plan without reading all of it.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "plan": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "default": 1,
          "type": "number",
          "const": 1
        },
        "version": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "goals": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "quickWins": {
          "default": [],
          "description": "Action IDs",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "actions": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "maxLength": 40
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "category": {
                "type": "string",
                "enum": [
                  "weed_control",
                  "soil",
                  "planting",
                  "water",
                  "habitat_structure",
                  "pest_animal",
                  "monitoring",
                  "other"
                ]
              },
              "priority": {
                "type": "string",
                "enum": [
                  "high",
                  "medium",
                  "low"
                ]
              },
              "effort": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ]
              },
              "season": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "summer",
                    "autumn",
                    "winter",
                    "spring"
                  ]
                }
              },
              "steps": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "targetSpecies": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "rationale": {
                "type": "string",
                "minLength": 1
              },
              "cautions": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "tag": {
                      "type": "string",
                      "enum": [
                        "bushfire",
                        "renter",
                        "council",
                        "pets",
                        "safety",
                        "other"
                      ]
                    },
                    "text": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "tag",
                    "text"
                  ]
                }
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "labourHours": {
                "type": "object",
                "properties": {
                  "low": {
                    "type": "number",
                    "minimum": 0
                  },
                  "high": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "low",
                  "high"
                ]
              },
              "materialsAud": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "low": {
                        "type": "number",
                        "minimum": 0
                      },
                      "high": {
                        "type": "number",
                        "minimum": 0
                      }
                    },
                    "required": [
                      "low",
                      "high"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ],
                "description": "null when there is no cost data (FR-70)"
              },
              "costAsOf": {
                "description": "Date of the cost reference used (FR-68)",
                "type": "string"
              },
              "window": {
                "type": "object",
                "properties": {
                  "startMonth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 12
                  },
                  "endMonth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 12
                  }
                },
                "required": [
                  "startMonth",
                  "endMonth"
                ]
              },
              "dependsOn": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "maintenanceHoursPerMonth": {
                "default": 0,
                "type": "number",
                "minimum": 0
              },
              "benefit": {
                "default": 3,
                "description": "Relative benefit, used to rank by benefit per hour",
                "type": "integer",
                "minimum": 1,
                "maximum": 5
              },
              "permanent": {
                "default": false,
                "description": "True for fixed works a renter may need permission for",
                "type": "boolean"
              },
              "plantings": {
                "default": [],
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "scientificName": {
                      "type": "string",
                      "minLength": 1
                    },
                    "commonName": {
                      "type": "string"
                    },
                    "quantity": {
                      "type": "integer",
                      "exclusiveMinimum": 0,
                      "maximum": 9007199254740991
                    },
                    "citationIds": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "scientificName",
                    "citationIds"
                  ]
                }
              },
              "done": {
                "description": "Set by mark_done (FR-71): month index in the plan and actual effort",
                "type": "object",
                "properties": {
                  "month": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 36
                  },
                  "hours": {
                    "type": "number",
                    "minimum": 0
                  },
                  "costAud": {
                    "type": "number",
                    "minimum": 0
                  }
                },
                "required": [
                  "month",
                  "hours",
                  "costAud"
                ]
              }
            },
            "required": [
              "id",
              "title",
              "category",
              "priority",
              "effort",
              "season",
              "steps",
              "rationale",
              "citationIds",
              "labourHours",
              "materialsAud",
              "window"
            ]
          }
        },
        "plantingList": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scientificName": {
                "type": "string",
                "minLength": 1
              },
              "commonName": {
                "type": "string"
              },
              "quantity": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "citationIds": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "scientificName",
              "citationIds"
            ]
          }
        },
        "monitoring": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "localResources": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string"
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "citationId": {
                "type": "string"
              }
            },
            "required": [
              "title",
              "citationId"
            ]
          }
        },
        "citations": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Stable citation ID returned by a tool, e.g. 'ala:occ:native-plants'"
              },
              "source": {
                "type": "string",
                "enum": [
                  "global_kb",
                  "local_kb",
                  "research",
                  "cost_reference"
                ]
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "url": {
                "type": "string",
                "format": "uri"
              },
              "publisher": {
                "type": "string"
              },
              "licence": {
                "type": "string"
              },
              "accessed": {
                "description": "ISO date the data was retrieved or checked",
                "type": "string"
              }
            },
            "required": [
              "id",
              "source",
              "title"
            ]
          }
        }
      },
      "required": [
        "version",
        "createdAt",
        "goals",
        "actions",
        "monitoring",
        "citations"
      ]
    },
    "section": {
      "type": "string",
      "enum": [
        "goals",
        "quick_wins",
        "actions",
        "planting_list",
        "monitoring",
        "local_resources",
        "citations"
      ]
    },
    "actionId": {
      "type": "string"
    }
  },
  "required": [
    "plan",
    "section"
  ]
}
```
