---
meta_version: 1
kind: analysis
status: draft
authority: low
domain:
  - architecture
  - cognition
  - governance
source: ocp-scraper
created: 2026-03-09
cssclasses:
  - status-draft
---

# OCP Scrape: Cognitive Architectures, Metacognition, Agent Frameworks

> Source document for three motif candidates extracted via OCP scrape + triad analysis.

## Scrape Summary

| Topic | Records | Indexed | Filtered | Top Record (Stars) |
|-------|---------|---------|----------|-------------------|
| cognitive-architecture | 27 | 14 | 13 | cognee (13,071) |
| metacognition | 15 | 8 | 7 | cognitive-workspace (95) |
| agent-framework | 15 | 15 | 0 | bettafish (37,058) |
| recursive self-improvement | 1 | 1 | 0 | recursive-agents (34) |

**Total:** 58 processed, 38 indexed, 355 domain edges, 88 port edges.

## Key Records Inspected

### AMPERE (socket-link/ampere)
- **Stars:** 33 | **Trust:** 0.344 | **Language:** Kotlin
- **Description:** Observable AI cognition. Every agent decision emits a structured, queryable event — "peer into the glass brain."
- **Architecture:** Events consumed by peer agents in real time. Multi-agent coordination is reactive, not scripted.
- **D/I/R relevance:** Direct architectural echo of Observer-native S1. Same event-emission pattern, but AMPERE's events are consumed live by other agents, not just archived.

### Epistemic Protocols (jongwony/epistemic-protocols)
- **Stars:** 49 | **Trust:** 0.243 | **Language:** JavaScript
- **Description:** Structure human-AI interaction quality at every decision point. Catch direction errors at the plan level, not the code level.
- **D/I/R relevance:** Governance operating on epistemic quality (understanding correctness) rather than functional boundaries. Challenges Observer-native's governance candidates, which are all functional.

### Cognitive Workspace (tao-hpu/cognitive-workspace)
- **Stars:** 95 | **Trust:** 0.294 | **Language:** TeX (paper)
- **Description:** Active memory management enabling functional infinite context through cognitive workspace architecture.
- **arXiv:** 2508.13171
- **D/I/R relevance:** Context window management as a cognitive architecture problem. Parallels Observer-native's S2 salience filter — what stays and what goes.

### LLM Introspective Compression (Dicklesworthstone)
- **Stars:** 31 | **Trust:** 0.036
- **Description:** Saving, compressing, and manipulating internal thought states for reasoning backtracking, latent thought optimization, and metacognitive control.
- **D/I/R relevance:** Metacognitive control as a first-class capability — the system can observe and modify its own reasoning process.

### MAGELLAN (flowersteam/MAGELLAN)
- **Stars:** 10 | **Trust:** 0.031 | **Language:** Python
- **Description:** Metacognitive predictions of learning progress guide autotelic LLM agents in large goal spaces.
- **arXiv:** 2502.07709
- **D/I/R relevance:** Strongest theoretical contribution. An agent that predicts its own learning progress and uses that prediction to prioritise what to work on. Direct model for what Observer-native's tension tracker could become.

### Recursive Agents (hankbesser/recursive-agents)
- **Stars:** 34 | **Trust:** 0.038 | **Language:** Python
- **Description:** Draft → Critique → Revision chains. Three-phase self-improvement. One protocol_context.txt feeds all system prompts.
- **D/I/R relevance:** PAI's 7-phase loop compressed to 3 steps. No equivalent of ISC — critique is freeform.

### Cognee (topoteretes/cognee)
- **Stars:** 13,071 | **Trust:** 0.726 | **Language:** Python
- **Description:** Knowledge engine for AI agent memory. Vector search + graph databases + cognitive science. Documents searchable by meaning and connected by relationships.
- **D/I/R relevance:** Relational (graph) memory vs Observer-native's episodic (sequential) memory. Challenges whether JSONL is sufficient for cross-session cognition.

### Branch-Thinking MCP (ssdeanx/branch-thinking-mcp)
- **Stars:** 15 | **Trust:** 0.071 | **Language:** TypeScript
- **Description:** Parallel branches of thought with semantic cross-references. Branch-based reasoning with clustering and visualisation.
- **D/I/R relevance:** Structural parallel to Observer-native's Oscillate module — multiple concurrent reasoning paths with cross-linking.

---

## Triad Analysis

### OSCILLATE (Describe) — Four Independent Perspectives

**Perspective 1: Observability**

AMPERE is the strongest architectural echo in the scrape — Observer-native's S1 adapter pattern independently invented. Both emit structured events for every agent decision. But AMPERE goes further: events are consumed live by peer agents. Multi-agent coordination becomes reactive rather than scripted. Observer-native currently emits events that only the session-end hook reads retroactively.

The "glass brain" metaphor names something Observer-native is building but hasn't named. The vault's `glass-box` motif is the governance version; AMPERE is the cognitive version.

**Perspective 2: Memory Architecture**

Three projects tackle the same S2 problem — cognitive continuity across sessions. Cognee (graph + vector), Cognitive Workspace (active retrieval), Observer-native (JSONL sequence + motifs). The scrape favours relational/graph memory — Cognee at 13k stars dominates.

Observer-native's unique position: the motif library is a middle layer between raw events and relational knowledge. Not a full graph, not a flat log. Named patterns that activate based on relevance scoring.

**Perspective 3: Self-Improvement Loops**

Recursive Agents compresses PAI's 7-phase loop to 3 steps (Draft→Critique→Revision). MAGELLAN introduces metacognitive prediction — an agent that predicts which gaps are most productive to close. Observer-native's tension tracker is the embryo of this, but currently passive.

**Perspective 4: Epistemic Governance**

Epistemic Protocols focuses on interaction quality at the plan level. Observer-native's governance candidates are all functional (boundary, scope, retry). None ask: "Is the agent's understanding correct?" This is a gap the external data reveals.

### CONVERGE (Interpret) — Three Patterns Survive Triangulation

**1. Event-stream-as-coordination-bus (live-event-bus)**

AMPERE, Observer-native S1, and Cognee all emit structured events. Usage models diverge: retroactive analysis, live inter-agent coordination, continuous knowledge graph updates. Convergent insight: the event stream is underused as a passive log. Multiple independent projects discovered that structured events become more valuable when consumed in real time.

**2. Memory-as-graph vs memory-as-sequence**

Not a motif candidate — this is a design question, not a recurring structural pattern. Observer-native's motif library occupies a unique middle position that external data doesn't invalidate.

**3. Metacognitive self-steering (metacognitive-steering)**

MAGELLAN, Recursive Agents, and LLM Introspective Compression all point to systems that model their own cognitive process. Observer-native's tension tracker is the embryo. MAGELLAN suggests tensions could be active steering signals — predicting which tension resolution would produce the most learning progress.

**4. Epistemic governance (epistemic-governance)**

Epistemic Protocols carries an insight that cuts across all perspectives: governance should operate on epistemic quality, not just functional boundaries. Observer-native's governance candidates are all functional. Checking understanding correctness would be a novel governance layer.

### REFLECT (Recommend) — Process + Motif Candidates

**Motif candidates surfaced:**

1. **live-event-bus** — Structured event streams gain value when consumed in real time by peer components, not just archived. Sharpens existing `observer-feedback-loop` by adding the real-time constraint. Primary axis: integrate. Derivative order: 1.

2. **metacognitive-steering** — Systems that model their own learning progress and use predictions to prioritise which gaps to close. No precursor in registry. Primary axis: recurse. Derivative order: 2.

3. **epistemic-governance** — Governance that checks direction quality and understanding correctness, not just functional boundary compliance. Challenges current governance roadmap. Primary axis: differentiate. Derivative order: 1.

**Framework delta:** D/I/R might be missing a fourth move — Predict. MAGELLAN's core insight is that metacognitive prediction is a separate cognitive act. Whether that's a fourth primitive or a specialisation of Interpret is an open question.
