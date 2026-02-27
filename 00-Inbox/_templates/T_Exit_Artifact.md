---
meta_version: 1
kind: exit_artifact
status: draft
authority: medium
domain: []
source: <% tp.system.suggester(["atlas_write", "gpt_build", "adam_decision"], ["atlas_write", "gpt_build", "adam_decision"]) %>
confidence: tested
mode: review
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
cssclasses: [status-draft]
motifs: []
refs: []
---

# Exit Artifact: <% tp.file.title %>

## Deliverable Summary
<!-- What was delivered? -->
<% tp.file.cursor() %>

## Acceptance Criteria Met
<!-- List each criterion and its pass/fail status -->
- [ ] 

## Artifacts
<!-- Files, commits, outputs produced -->

## Sign-off
<!-- Who approved? When? Any conditions? -->
