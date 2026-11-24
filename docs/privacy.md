# Privacy

Greener's server keeps no site location, profile, plan or user document after a tool call ends (D-09, NFR-09). There is no telemetry in release 1.

| Data | Where it goes |
| --- | --- |
| Answers, profile, research, plans | The user's own Claude Project. Claude sends the fields a tool needs in each call, and the server forgets them when the call ends. |
| User documents (local KB) | They stay in the Claude Project and never go to the server (FR-43). |
| Site coordinates | Rounded to 2 decimal places (about 1 km) before they are sent to the Atlas of Living Australia. For the bushfire-prone land check (D-18), rounded to 3 decimal places (about 100 m) and sent to the NSW Spatial Services map server, which hosts the NSW RFS map. |
| Street address | When the user types one, it goes to the NSW Address Location Service (NSW Spatial Services) to find the coordinates (D-19). It is not cached or logged, and the plan keeps only the suburb. |
| Edge cache | Public ALA responses only, keyed by the rounded query, for 7 days. Address lookups and queries at about 100 m precision, such as the bushfire check, are never cached. |
| Logs | Tool name, duration and result (`ok` or `error`). No location and no user text (Section 12.5). |
| Threatened species | Exports list species names only, never record locations (NFR-10). |
