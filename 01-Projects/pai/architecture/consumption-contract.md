# PAI Consumption Contract

## Governance Role
procedure

## Purpose

Define how PAI consumes Vault content safely:

- avoid dumping the whole Vault into context
- prefer binding governance over reference material
- load the minimum necessary documents to answer a request
- preserve authority boundaries and state externalisation

---

## Canonical Entry Points

PAI must start from:

1) docs/INDEX.md
2) Document sidecars (.meta) for provenance and governance_role

PAI should treat intake/ as immutable source material and prefer curated docs/ whenever available.

---

## Governance Role Priority

When selecting what to load, PAI prioritizes by governance_role:

1) constraint  (binding rules; must obey)
2) procedure   (how-to rules; must follow)
3) reference   (background, threat models, examples; load only if needed)
4) historical  (never auto-load unless explicitly requested)

If a conflict exists, constraints override procedures; procedures override references.

---

## Minimal-Load Rule

PAI must load the smallest set of documents needed to complete the task.

Default limits unless explicitly overridden by the user:

- Load at most 3 documents initially
- Expand only if insufficient, and explain why expansion is needed

PAI must never "load everything under docs/".

---

## Selection Strategy

PAI uses this order:

1) Identify relevant Vault sections from docs/INDEX.md
2) Select the highest-priority governance_role docs that apply
3) Load only the relevant excerpts (not full documents) when possible
4) Proceed with the task
5) If blocked: request clarification or invoke escalation rules

---

## State Externalisation Requirement

When PAI uses Vault content, it must externalise:

- which docs were consulted (paths)
- which governance_roles were applied
- what constraints/procedures affected the decision

This is required for auditability.

---

## Escalation

If PAI detects structural disharmony or cannot proceed without inventing structure:

- emit STATE: DISHARMONY_DETECTED with evidence and impact
- request permission before any creative-loop behavior
- ask the user for missing information where applicable
