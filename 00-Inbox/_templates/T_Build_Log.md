---
meta_version: 1
kind: build_log
status: draft
authority: low
domain: []
source: <% tp.system.suggester(["atlas_write", "gpt_build", "adam_decision"], ["atlas_write", "gpt_build", "adam_decision"]) %>
confidence: provisional
mode: build
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
cssclasses: [status-draft]
motifs: []
refs: []
---

# Build Log — <% tp.file.title %>

## Objective
<!-- What are we building/implementing? -->
<% tp.file.cursor() %>

## Steps Taken
<!-- Chronological log of what was done -->

## Results
<!-- What was the outcome? -->

## Issues Encountered
<!-- Problems hit, workarounds used -->

## Next Steps
<!-- What remains to be done? -->
