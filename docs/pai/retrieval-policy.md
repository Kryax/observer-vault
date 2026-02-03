# PAI Retrieval Policy

## Governance Role
procedure

## Purpose

Define the safe retrieval flow PAI uses to find relevant Vault content.

---

## Retrieval Flow

1) Read docs/INDEX.md to locate relevant sections
2) Prefer curated docs/ over intake/
3) Prefer higher governance_role priority (constraint > procedure > reference)
4) Load only what is needed to answer the request
5) If insufficient: expand selection incrementally, stating why

---

## Default Retrieval Limits

Unless explicitly overridden by the user:

- Start with up to 3 docs
- Expand by 1–2 docs per iteration
- Stop expanding when the task can be completed

---

## Excerpt First

Prefer loading excerpts:

- relevant headings
- minimal supporting paragraphs

Avoid full-document ingestion unless the doc is short or the task requires completeness.

---

## When Retrieval Is Blocked

If retrieval cannot locate the required info:

- say what was searched (INDEX sections, doc paths)
- request user clarification OR
- escalate via STATE: DISHARMONY_DETECTED if constraints conflict or structure is incomplete
