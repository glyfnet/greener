# D-11: Knowledge base model

- Status: Accepted
- Date: 2026-11-24
- Source: [specification Section 2, Decision log](../specification.md#2-decision-log)

## Context and problem

Knowledge base model: what does Greener do? This decision is recorded in the specification's decision log. The specification is the source of truth; this file records the decision in MADR form so that a later change can supersede it.

## Decision

Global KB curated by the maintainer. Each user adds their own items to a local KB in their Claude Project.

## Consequences

The global index ships with the server. The user KB never goes to the server.
