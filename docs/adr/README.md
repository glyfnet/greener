# Architecture decision records

One file per decision ID in the specification's decision log (Section 2), in [MADR](https://adr.github.io/madr/) form (Section 12.4). A changed decision gets a new ADR that supersedes the old one; the old file stays, marked *Superseded by*.

The closed decisions D-01 to D-17 come straight from the specification. Proposed ADRs (P-…) record choices made while building the first release that the maintainer has not yet accepted. Each needs a new decision row in specification Section 2 before it becomes final.

| ID | Decision | Status |
| --- | --- | --- |
| [D-01](d-01-delivery-model.md) | Delivery model | Accepted |
| [D-02](d-02-geographic-scope.md) | Geographic scope | Accepted |
| [D-03](d-03-llm-provider.md) | LLM provider | Accepted |
| [D-04](d-04-rag-sources.md) | RAG sources | Accepted |
| [D-05](d-05-who-pays-and-how-users-install.md) | Who pays, and how users install | Accepted |
| [D-06](d-06-rag-search.md) | RAG search | Accepted |
| [D-07](d-07-answer-mode.md) | Answer mode | Accepted |
| [D-08](d-08-server-language.md) | Server language | Accepted |
| [D-09](d-09-user-data-on-the-server.md) | User data on the server | Accepted |
| [D-10](d-10-hosting.md) | Hosting | Accepted |
| [D-11](d-11-knowledge-base-model.md) | Knowledge base model | Accepted |
| [D-12](d-12-project-model.md) | Project model | Accepted |
| [D-13](d-13-iek.md) | IEK | Accepted |
| [D-14](d-14-licences.md) | Licences | Accepted |
| [D-15](d-15-global-kb-content.md) | Global KB content | Accepted |
| [D-16](d-16-funding.md) | Funding | Accepted |
| [D-17](d-17-planting-and-chemical-policy.md) | Planting and chemical policy: local natives only, no chemicals | Accepted |
| [P-01](p-01-toolchain-node-22.md) | Toolchain: Node 22, wrangler 4, Vitest 5 | Proposed |
| [P-02](p-02-mcp-transport.md) | MCP transport: official SDK, stateless web-standard Streamable HTTP | Proposed |
| [P-03](p-03-species-checks.md) | Species checks from ALA establishment data while the weed list is empty | Proposed |
| [P-04](p-04-stateless-save-tools.md) | `save_*` tools validate and return data; Claude saves it | Proposed |
