---
meta_version: 1
kind: summary
status: draft
authority: low
domain: [vault]
source: vault_synthesis
---

# Atlas Activity

## Recent Atlas Writes
```dataview
TABLE kind, status, dateformat(file.ctime, "yyyy-MM-dd HH:mm") AS "Created"
FROM ""
WHERE source = "atlas_write" OR source = "gpt_build"
SORT file.ctime DESC
LIMIT 15
```

## Atlas Documents by Status
```dataview
TABLE length(rows) AS "Count"
FROM ""
WHERE source = "atlas_write" OR source = "gpt_build"
GROUP BY status
```
