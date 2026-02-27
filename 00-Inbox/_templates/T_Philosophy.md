---
meta_version: 1
kind: philosophy
status: draft
authority: low
domain: [philosophy]
source: <% tp.system.suggester(["adam_decision", "claude_conversation", "vault_synthesis"], ["adam_decision", "claude_conversation", "vault_synthesis"]) %>
confidence: speculative
mode: reflect
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
cssclasses: [status-draft]
motifs: []
refs: []
---

# <% tp.file.title %>

## Thesis
<!-- The core claim or insight -->
<% tp.file.cursor() %>

## Supporting Arguments
<!-- Evidence, reasoning, cross-domain validation -->

## Counterarguments
<!-- What challenges this? Where might it break down? -->

## Implications
<!-- If this is true, what follows? -->
