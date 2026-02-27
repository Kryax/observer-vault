---
meta_version: 1
kind: summary
status: draft
authority: low
domain: [vault]
source: vault_synthesis
---

# Status Board

## Inbox — Unprocessed
```dataview
TABLE kind, source, dateformat(file.ctime, "yyyy-MM-dd") AS "Created"
FROM ""
WHERE status = "inbox"
SORT file.ctime DESC
```

## Draft — In Progress
```dataview
TABLE kind, authority, domain, dateformat(file.mtime, "yyyy-MM-dd") AS "Modified"
FROM ""
WHERE status = "draft"
SORT file.mtime DESC
```

## Review — Awaiting Promotion
```dataview
TABLE kind, authority, confidence, source
FROM ""
WHERE status = "review"
SORT file.mtime ASC
```

## Canonical — Accepted Truth
```dataview
TABLE kind, authority, confidence, dateformat(file.mtime, "yyyy-MM-dd") AS "Modified"
FROM ""
WHERE status = "canonical"
SORT file.mtime DESC
```

## Archived
```dataview
TABLE kind, dateformat(file.mtime, "yyyy-MM-dd") AS "Archived"
FROM ""
WHERE status = "archived" OR status = "superseded"
SORT file.mtime DESC
LIMIT 10
```
