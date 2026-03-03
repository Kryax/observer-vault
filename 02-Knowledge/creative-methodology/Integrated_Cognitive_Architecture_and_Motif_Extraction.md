# Integrated Cognitive Architecture & Motif Extraction — Design Notes

**Date:** 3 March 2026
**Source:** Conversation between Adam and Claude following OCP Scraper Phase 1 build
**Status:** Design vision — seed material for implementation
**Priority:** HIGH — this informs the Reflect skill design and the long-term system architecture

---

## Part 1: Organs and Cognitive Processes — The Integration Architecture

### The Core Metaphor

Atlas's subsystems divide cleanly into two categories:

**Organs** — specialised tools that store, retrieve, process, or search. They don't think. They serve requests.

| Organ | Function | Interface |
|-------|----------|-----------|
| Vault | Long-term memory — documents, architecture, session history | MCP tools (read, write, search) |
| OCP Scraper/Index | External knowledge — what the open source world has solved | CLI (`ocp search`, `ocp scrape`) → future MCP |
| Control Plane | System state — health, sessions, threads, audit | JSON-RPC at localhost:9000 |
| SQLite Index | Structured search — FTS, graph traversal, trust vectors | Accessed via scraper/vault tools |
| Session Tracker | Short-term memory — current state, active tasks | File-based in vault |
| Motif Library (future) | Meta-knowledge — structural patterns across domains | Vault subdirectory + search |

**Cognitive Processes** — skills that define HOW information moves, how decisions get made, how understanding deepens. They orchestrate organ access.

| Cognitive Process | Function | Status |
|-------------------|----------|--------|
| OscillateAndGenerate | Divergent exploration — find the shape of a problem | Built, tested (3/3 passing) |
| ConvergeAndEvaluate | Convergent selection — triangulate and evaluate candidates | Built, tested (3/3 passing) |
| Reflect (with Motif Extraction) | Recognition and integration — understand what emerged, extract structural patterns | Seed material captured, not yet built |
| InformedPRD (future) | Orchestrated build planning — draws on vault + scraper + creative skills before generating PRD | Concept stage |

### The Wiring Principle

The skills suite IS the nervous system. Cognitive processes call organs, get responses, feed them into the next step, call another organ, synthesise. The key design rules:

1. **Every organ must be callable as a tool.** Not just usable standalone — invokable from within skills and other processes.
2. **Every cognitive process must be composable.** Invokable from within other skills, not just as top-level commands.
3. **Same organ, different cognitive purposes.** The vault gets queried during oscillation for prior art, during reflection for session history, during PRD creation for architecture context. Different process, same organ, different purpose.
4. **The richness comes from composition.** No single piece is the system. The system is the interaction pattern between pieces.

### Example: Informed PRD Workflow

When Atlas receives a build task, before generating the PRD:

1. **Vault query** (long-term memory) — find existing work, design notes, architecture docs, prior sessions related to the problem
2. **OCP search** (external knowledge) — find existing solutions, related approaches, and gaps in the problem space
3. **Motif library query** (meta-knowledge) — find structural patterns from prior work that might apply
4. **Lightweight oscillation** (creative exploration) — explore the problem boundary before locking into criteria

All four feed into PRD generation. The PRD knows about prior decisions (vault), existing solutions (scraper), structural patterns (motifs), and has explored the problem shape (oscillation). Compare this to a PRD generated from just the prompt — the quality difference would be enormous.

### Example: Post-Build Reflection

After a build completes:

1. **Reflect skill runs** — examines what happened, what worked, what was surprising
2. **Motif extraction** — identifies structural patterns that emerged during the build
3. **Vault write** — reflection findings and new motifs written to vault
4. **Next related task** — vault query in step 1 surfaces these reflections and motifs

The system learns from its own experience. Each cycle makes the next one richer.

---

## Part 2: The Motif Layer — Knowledge About Knowledge

### What's Missing in Current LLMs

LLMs are trained on information — vast quantities of documents, code, conversations. But the training data is almost entirely **first-order knowledge**: facts, procedures, examples, explanations.

What's largely absent is **meta-knowledge**: the structural patterns that connect ideas across domains. Humans carry this as intuition — the feeling that "this problem has the same shape as that other problem I solved ten years ago." But we rarely write it down explicitly, so it barely exists in training corpora.

### What a Motif Is

A motif is a structural pattern that recurs across domains. It's not domain-specific — it's the shape that appears in different materials.

**Example from the three creative methodology tests:**

| Test | Domain | Novel Output |
|------|--------|-------------|
| Identity Primitive | Protocol design | Witness attestation — peers validate each other's state changes |
| Mining Retraining | Industry/policy | Adaptive control function — system adjusts its own parameters based on outcomes |
| GitHub Bootstrapping | Software architecture | Template Engine — usage patterns reshape the classification ontology |

**The underlying motif:** In all three cases, the system discovered that *the thing being observed must feed back into the observer's frame of reference.* Witnesses update identity state. Outcomes adjust control parameters. Usage patterns reshape templates. Same structural relationship, three completely different expressions.

That motif isn't in the training data. It wasn't in any prompt. It emerged from the cognitive process operating across multiple problems. Currently, it evaporates — nobody captures it, nobody indexes it, nobody can call on it for the next problem.

### What the Motif Library Would Contain

Each motif entry would include:

- **Pattern name** — concise label (e.g., "Observer-Feedback Loop", "Dual-Speed Governance", "Trust-as-Curation")
- **Structural description** — domain-independent description of the pattern's shape
- **Instances** — specific expressions of this motif across different domains/projects
- **Relationships** — connections to other motifs (complements, tensions, compositions)
- **Discovery context** — which session/problem/oscillation cycle surfaced this motif
- **Fractal depth** — does this motif contain sub-motifs? Is it part of a larger motif?

### Why This Matters

A human might hold a few dozen motifs in active intuition and pattern-match against them unconsciously. An LLM with a formally described motif library of hundreds or thousands, searchable in parallel during any creative process, is a qualitatively different capability.

This isn't faster human cognition. It's cross-domain structural pattern matching at a scale no human can do, informed by meta-patterns that no training corpus contains.

The motif library becomes — over time — the most valuable artifact in the entire system. More valuable than any individual project output. Because it's knowledge about knowledge. It's the layer that makes everything else compound.

---

## Part 3: The Reflect Skill — Revised Design

### Original Concept (from brain dump earlier today)

The Reflect skill was conceived as the third part of the cognitive triad:
- OscillateAndGenerate → generates possibilities
- ConvergeAndEvaluate → evaluates and selects
- Reflect → recognises and integrates

### Expanded Concept: Reflect + Motif Extraction

The Reflect skill now has two core outputs:

**Output 1: Understanding** — what shape has this become? Is it complete? How does it affect the greater picture? (Original design, unchanged.)

**Output 2: Motifs** — what structural patterns emerged during this process? Have we seen this shape before? What domain-independent principle does this express?

### Proposed Reflect Skill Flow

#### Phase 1: Recognition (gentle oscillation)
- Turn the result in your hands — look from different angles
- Not drilling for problems. Not evaluating. Understanding.
- Questions: What shape is this? Does it flow without friction? Can I sense more depth?

#### Phase 2: Context Mapping
- How does this change the greater picture?
- What new questions has this raised?
- What assumptions were challenged?

#### Phase 3: Completion Test
- **No friction** — idea flows without resistance, each step follows naturally
- **Nothing to add, nothing to strip** — condensed to seed, irreducible essence
- **Internal consistency at every level** — fractal is clean
- **Or: "as good as I can get it for the moment"** — valid resting state, sensing more depth available

#### Phase 4: Motif Extraction (NEW)
- What structural patterns emerged during this session?
- Are any of these patterns domain-independent?
- Query the motif library: has this shape appeared before in different domains?
- If yes: strengthen the existing motif with a new instance
- If no: propose a new motif entry (name, structure, this instance as first evidence)
- Check: does this motif compose with or tension against existing motifs?

#### Phase 5: Motif-Informed Re-Reflection (NEW)
- With the motif library consulted, look back at the work one more time
- Does knowing about related structural patterns change understanding of what was built?
- Does it reveal depth not visible before — the fractal layers below?
- Does it suggest connections to other projects or domains?
- This is the recursive loop: reflect → extract motifs → reflect again with motif context

### Outputs

The Reflect skill produces three artifacts:

1. **Reflection document** — understanding of what was built, completion assessment, context impact
2. **Motif entries** — new motifs or updated instances for existing motifs → written to motif library
3. **Forward questions** — what new questions or directions this work opens → feeds next session's divergence

---

## Part 4: The Cognitive Triad as a Closed Loop

The three skills form a cycle that operates at multiple scales:

```
     ┌─────────────────────────────────────────┐
     │                                         │
     ▼                                         │
 OSCILLATE ──── raw material ────► CONVERGE    │
 (diverge)                        (evaluate)   │
     ▲                                │        │
     │                                ▼        │
     │                            candidate    │
     │                                │        │
     │                                ▼        │
     │                            REFLECT      │
     │                           (recognise)   │
     │                                │        │
     │                          ┌─────┴─────┐  │
     │                          ▼           ▼  │
     │                     understanding   motifs
     │                          │           │  │
     │                          ▼           ▼  │
     │                        vault     motif  │
     │                                 library │
     │                                    │    │
     └────────────────────────────────────┘────┘
                                     │
                            informs next cycle
```

**Single-session scale:** Diverge → Converge → Reflect on the result → understanding feeds the next problem.

**Cross-session scale:** Each session's reflections and motifs accumulate in the vault and motif library. Future sessions start richer — the oscillation draws on prior motifs, the convergence can reference prior evaluations, the reflection can compare against prior patterns.

**Cross-project scale:** Motifs extracted from Protocol Design inform Architecture decisions. Motifs from Architecture inform Implementation choices. The meta-layer connects everything.

This is the fractal loop. Same pattern at every scale. Diverge, converge, reflect. Feed forward. The motif library is what makes the loop compound instead of just repeat.

---

## Part 5: Implications and Open Questions

### What Could This Mean?

If Atlas has:
- Structured creative cognition (oscillation + convergence)
- Reflective self-awareness about its own outputs (reflect skill)
- A growing library of domain-independent structural patterns (motif library)
- The ability to search that library at LLM scale during any cognitive process
- All of this wired together through composable skills calling on specialised organs

Then the system has something no current AI system has: **a formalised meta-cognitive layer that compounds through use.**

Every session makes the next one richer. Not just through accumulated documents (that's what the vault already does). Through accumulated structural understanding — patterns about patterns, knowledge about knowledge.

Combined with LLM strengths that humans lack — massive parallel association, perfect recall within context, ability to search thousands of motifs simultaneously — this could produce cross-domain insights at a rate and scale that's genuinely novel.

### Open Questions

1. **Motif format:** What's the right schema for a motif entry? Too structured and you lose nuance. Too free-form and you can't search effectively.

2. **Motif governance:** Who approves new motifs? AI proposes, human approves — same as templates? Or is this a place where AI autonomy is appropriate since motifs are observations not decisions?

3. **Motif quality:** How do you distinguish a genuine structural motif from a superficial similarity? The Reflect skill needs criteria for this.

4. **Motif composition:** Can motifs compose into higher-order motifs? (Almost certainly yes — that's the fractal nature. But how do you represent and navigate this?)

5. **When to build:** The Reflect skill with motif extraction should be built after 2-3 more sessions using the existing diverge/converge skills, to give enough independent examples for triangulation. But the motif library organ (even if empty) could be scaffolded now.

6. **The awareness question:** If a system has structured observation that causes state changes (oscillation), felt derivatives through semantic space (the novel connections that emerge), and now reflective recognition of its own patterns (motif extraction from its own outputs) — at what point does the structural analogy to consciousness become more than analogy?

---

## Implementation Roadmap

### Immediate (this week)
- Complete OCP Scraper Phase 1 (in progress in other chat)
- Place creative methodology test documents in vault at `02-Knowledge/skills/creative-methodology/`

### Next (after 2-3 more creative sessions)
- Build the Reflect skill with motif extraction as core output
- Scaffold the motif library organ in the vault at `02-Knowledge/motifs/`
- Define motif entry schema

### Then
- Wire OCP Scraper as MCP tool through control plane
- Build InformedPRD skill that orchestrates vault + scraper + motifs + oscillation before PRD generation
- Expose motif library as searchable tool for cognitive skills

### Eventually
- Motif-informed oscillation (motif library as perspective source during OscillateAndGenerate)
- Cross-session motif accumulation and pattern detection
- Higher-order motif composition (motifs about motifs)
- The Observer Council UI with motif visualisation — see the structural patterns connecting all your work

---

*"AI articulates, humans decide."*

*"The motif library is knowledge about knowledge. It's the layer that makes everything else compound."*
