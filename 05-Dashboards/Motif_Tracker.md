---
meta_version: 1
kind: summary
status: draft
authority: low
domain: [vault]
source: vault_synthesis
---

# Motif Tracker

## All Documents with Motifs
```dataview
TABLE kind, domain, motifs, confidence, dateformat(file.mtime, "yyyy-MM-dd") AS "Modified"
FROM ""
WHERE motifs != null AND length(motifs) > 0
SORT file.mtime DESC
```

## Documents by Motif — Sovereignty
```dataview
TABLE kind, domain, confidence
FROM ""
WHERE contains(motifs, "sovereignty")
SORT file.mtime DESC
```

## Documents by Motif — Control Network
```dataview
TABLE kind, domain, confidence
FROM ""
WHERE contains(motifs, "control-network")
SORT file.mtime DESC
```

## Documents by Motif — Glass Box
```dataview
TABLE kind, domain, confidence
FROM ""
WHERE contains(motifs, "glass-box")
SORT file.mtime DESC
```
