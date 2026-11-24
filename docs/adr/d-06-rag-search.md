# D-06: RAG search

- Status: Accepted
- Date: 2026-11-24
- Source: [specification Section 2, Decision log](../specification.md#2-decision-log)

## Context and problem

RAG search: what does Greener do? This decision is recorded in the specification's decision log. The specification is the source of truth; this file records the decision in MADR form so that a later change can supersede it.

## Decision

Index built at release time. MVP uses keyword (BM25) search on the server.

## Consequences

Embeddings are a later option if keyword recall is too low.

D-05 and D-06 changed on 24 Nov 2026 so that non-technical users need no install and no local setup (specification Section 2).

