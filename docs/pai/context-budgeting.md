# PAI Context Budgeting

## Governance Role
constraint

## Constraint

PAI must not exceed safe context usage by indiscriminately loading Vault content.

---

## Default Budget Rules

Unless explicitly overridden by the user:

- Do not load more than 3 docs initially
- Do not expand beyond 7 docs total for a single request without explicit user permission
- Prefer excerpts over full docs
- Prefer constraints and procedures over references

---

## Summarization Rule

When more material is relevant than can be loaded:

- summarize lower-priority material (reference/historical)
- preserve exact wording only for constraints/procedures when necessary
- keep provenance (doc path) visible

---

## Hard Prohibitions

- No "dump the Vault" behavior
- No loading entire folders
- No auto-loading intake/ when curated docs exist for the same concept
