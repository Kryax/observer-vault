---
meta_version: 1
kind: summary
status: draft
authority: low
domain: [vault, memory]
source: vault_synthesis
---

# Memory Health

## Priming Documents
```dataview
TABLE kind, status, confidence, dateformat(file.mtime, "yyyy-MM-dd") AS "Modified"
FROM ""
WHERE kind = "priming" OR kind = "summary"
SORT file.mtime DESC
```

## Knowledge Base Coverage
```dataview
TABLE length(rows) AS "Count"
FROM "02-Knowledge"
GROUP BY kind
```

## Documents Missing Key Metadata
```dataview
TABLE kind, status
FROM ""
WHERE status = null OR kind = null OR authority = null
SORT file.mtime DESC
```
