---
meta_version: 1
kind: summary
status: draft
authority: low
domain: [vault]
source: vault_synthesis
---

# Vault Home

## Recent Documents
```dataview
TABLE status, authority, kind, dateformat(file.mtime, "yyyy-MM-dd") AS "Modified"
FROM ""
WHERE status != null
SORT file.mtime DESC
LIMIT 20
```

## Documents Awaiting Promotion
```dataview
TABLE kind, authority, confidence, source
FROM ""
WHERE status = "review"
SORT file.mtime ASC
```

## Document Counts by Status
```dataview
TABLE length(rows) AS "Count"
FROM ""
WHERE status != null
GROUP BY status
```
