---
meta_version: 1
kind: policy
status: draft
authority: low
domain: [governance]
source: <% tp.system.suggester(["adam_decision", "claude_conversation", "gpt_build"], ["adam_decision", "claude_conversation", "gpt_build"]) %>
confidence: provisional
mode: design
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
cssclasses: [status-draft]
motifs: []
refs: []
---

# Policy: <% tp.file.title %>

## Scope
<!-- What does this policy cover? Who does it affect? -->
<% tp.file.cursor() %>

## Policy Statement
<!-- The actual policy, clear and unambiguous -->

## Rationale
<!-- Why does this policy exist? What problem does it prevent? -->

## Enforcement
<!-- How is this policy enforced? By whom? -->

## Exceptions
<!-- Are there valid exceptions? Under what conditions? -->
