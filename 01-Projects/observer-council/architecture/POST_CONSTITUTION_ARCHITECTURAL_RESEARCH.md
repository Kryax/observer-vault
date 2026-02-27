# Post-Constitution Architectural Research & Planning

**Status:** Research document (non-canonical, non-authoritative)
**Date:** 2026-02-10
**Inputs:** Observer codebase, PAI codebase, Draft Observer Constitution (2026-02-10), Claude Code Agent Teams documentation
**Constraints:** No code. No repo modifications. No prescriptions. No conflict resolution.

---

## Context

A constitutional synthesis was completed on 2026-02-10, producing a draft document with 97 constitutional principles, 7 unresolved conflicts, and 12 open ambiguities from 44 source documents across Observer and PAI. The constitution explicitly states: **"Future systems must be evaluated AGAINST this constitution, NOT derived FROM it."**

The question is now: what system shape could honor both projects' strengths, anticipate Claude Code Agent Teams as the execution substrate, and preserve human authority — without prematurely committing to any single path?

Agent Teams are a concrete, current technology: Claude Code's research preview (Opus 4.6) where a team lead coordinates multiple parallel Claude Code sessions via shared task lists and peer-to-peer messaging. Each teammate is a full Claude Code instance with its own context window, tools, and permissions. The lead makes autonomous approval decisions over teammate plans. This is not speculative — it shipped February 5, 2026.

**What follows is exploratory analysis. It is designed to be questioned and possibly rejected.**

---

## 1. System Direction Options

Four viable paths forward, each with genuine merit and genuine risks.

### Option A: Build Directly on Observer

Extend Observer's existing codebase (`/srv/observer/observer-workspace`), adding PAI-informed patterns as new layers within its governance framework.

**Pros:**
- Complete git history preserved — every governance decision, repair, and RESTORE step in one `git blame`
- Lowest startup cost — existing governance docs, verification scripts, and council structures already work
- Observer's receipt chain and provenance model remain unbroken
- No migration needed — Council, Airlock, work packets continue as-is

**Cons:**
- Observer is in RESTORE phase with structural assumptions (MCP architecture, OpenCode executor) that may not match Agent Teams' model
- PAI's patterns (ISC, capability composition, hooks) become guests in Observer's house — structurally subordinate
- The 7 constitutional conflicts are embedded in Observer's file system as contradictory documents that coexist; adding more complexity without resolving them risks compounding ambiguity
- Violates the constitution's own directive: building on Observer IS derivation FROM it, not evaluation AGAINST it
- Evolution capacity is lowest — Observer's directory layout, naming, and governance document structure constrain what can be added

**Agent Teams fit:** Most constrained. Agent Teams would need to operate within Observer's existing Council/executor architecture, where the Council is read-only and the Builder is disabled. The team lead's autonomous approval authority collides with Observer's "AI articulates, Human decides" principle.

**Governance clarity:** MEDIUM-LOW — Observer's existing governance applies but was not designed for multi-agent parallel execution.

**Auditability:** HIGH — single repo, single history, single blame.

**Evolution capacity:** LOW — structural inheritance limits future directions.

---

### Option B: Fork Observer into a New Project

Create a git fork that preserves Observer's history but allows independent evolution — restructuring, renaming, and adding PAI patterns without affecting the original.

**Pros:**
- History preserved at fork point — provenance chain intact up to the synthesis moment
- Freedom to restructure (merge docs, rename directories, add PAI patterns) without breaking the original
- Fallback position: original Observer remains untouched if the fork fails
- Incremental divergence — starts as Observer, gradually becomes something new

**Cons:**
- Identity confusion: is the fork "Observer v2" or a new system? This ambiguity persists throughout the project's life
- Inherited structural assumptions — forks rarely escape their ancestor's organizational gravity; the tendency is to "add PAI here" rather than rethink from principles
- Fork divergence management is a perpetual tax — improvements in either project must be manually ported
- Also violates the constitutional directive — a fork is derivation by definition (shared git ancestry)
- Two repos claiming the same history creates a provenance ambiguity that contradicts receipt-chain philosophy

**Agent Teams fit:** Moderate freedom. The fork can restructure to accommodate Agent Teams more naturally than Option A, but Observer's governance framing still shapes how teams are understood — they are additions to Observer, not peers.

**Governance clarity:** MEDIUM — governance is "in flux" during transition, with old rules being revised and new rules being drafted.

**Auditability:** MEDIUM-HIGH — history preserved, but the boundary between inherited and new decisions requires annotation beyond what git provides.

**Evolution capacity:** MEDIUM — better than A (restructuring permitted), worse than C (starting point is still Observer's structure).

---

### Option C: Clean New Repository Informed by Both

Start fresh with no git history from either project. Cherry-pick patterns, principles, and implementations from both Observer and PAI. Design the structure, naming, and governance from scratch for the synthesized system.

**Pros:**
- Intentional design — every file and directory exists because a deliberate decision was made, not because an ancestor had it
- Equal weight to both ancestors — neither Observer nor PAI is structurally privileged
- Clean governance from day one — the 97 principles, 7 conflicts, and 12 ambiguities can be encoded natively
- Maximum evolution capacity — no structural constraints from either ancestor
- Simplest mental model for future contributors — one coherent system, not a palimpsest

**Cons:**
- Loss of git history — `git blame` and `git bisect` start from zero, which matters deeply for a system that values "steps are visible, results are verifiable, provenance is recorded"
- Cherry-picking is error-prone — Observer has 66+ markdown files and 95+ shell scripts; deciding what to port and what to leave behind requires deep understanding of both projects
- Governance vacuum during construction — until governance is fully established, the system operates without protections Observer spent months building
- "Second system effect" risk — clean starts invite over-engineering and premature abstraction
- Ambiguous on constitutional compliance — cherry-picking IS implicit derivation, just less traceable

**Agent Teams fit:** Strongest position. Agent Teams can be designed as first-class citizens from the start — their governance boundary, capability model, and constitutional relationship are all native rather than retrofitted.

**Governance clarity:** LOW initially (vacuum during construction), HIGH eventually (native governance).

**Auditability:** LOW initially (no history), MEDIUM-HIGH eventually (builds its own trail, but "why does this rule exist?" requires external cross-reference).

**Evolution capacity:** HIGH — maximum freedom in any direction.

---

### Option D: Observer as Constraint Layer, New Repo for Implementation

Two-repository architecture. Observer remains a living governance/constitutional authority. A new implementation repository is created, informed by both Observer and PAI patterns, and evaluated AGAINST Observer's constitution rather than derived from it.

**Pros:**
- Directly honors the constitutional directive — the constitution is Observer, the system is evaluated against it; the separation is structural, not conceptual
- Clean separation of concerns — governance documents (slow-changing, deliberative) and implementation (fast-changing, iterative) have different cadences and belong in different repos
- Observer retains its identity and value — not subsumed, forked, or abandoned
- Implementation repo has clean structure (like Option C) but with an explicit external authority to design against — productive constraint
- Agent Teams have the clearest governance relationship: implemented HERE, governed by THERE — analogous to how constitutions and laws work in practice
- Evolution is decoupled — governance can evolve without implementation changes and vice versa

**Cons:**
- Cross-repo synchronization overhead — when governance updates, implementation must be re-evaluated; when implementation discovers governance gaps, Observer must be updated
- Constitutional compliance is hard to automate — "receipts are immutable" can be tested; "structure exists to preserve meaning" requires human judgment
- Split provenance — the full picture requires consulting both repos, increasing cognitive load
- Observer's RESTORE-phase documents may not be constitution-ready — significant preparatory work needed to clarify which documents are constitutional vs. operational
- Governance ossification risk — if Observer is treated with excessive reverence, it may resist necessary evolution
- Twice the maintenance surface — two READMEs, two CI pipelines, two contribution guidelines

**Agent Teams fit:** Most productively constrained. Teams have full operational freedom in the implementation repo — dynamic composition, parallel execution, autonomous coordination — but are accountable to Observer's constitutional principles. This mirrors how effective organizations work: operational freedom within constitutional constraints.

**Governance clarity:** HIGH — Observer IS the governance; the implementation IS the governed. No ambiguity about where authority lives.

**Auditability:** HIGH — two complementary trails. Observer's log shows governance evolution. Implementation's log shows system evolution. Constitutional compliance evaluations cross-reference them.

**Evolution capacity:** HIGH — decoupled evolution is the strongest form; each repo changes at its own pace.

---

### Cross-Cutting Observations

**Constitutional directive compliance ranking:** D >> C > B > A

**Constitutional conflict most impacted by repo choice:** CONF-01/CONF-05 (Security vs Human Authority) interacts with all options — but the *structural* conflict most impacted is whether "evaluated AGAINST" or "derived FROM" is enforced. Only Option D enforces this structurally.

**No hybrid analysis included here.** Sequences like "start with C, evolve into D" or "start with A, extract governance into separate repo later" are valid but not analyzed. This is noted as an open question.

---

## 2. Governance Models for Agent Teams

### The Core Problem

Agent Teams introduce a new governance challenge that neither Observer nor PAI was designed for: **the team lead makes autonomous approval decisions over teammate plans without direct human involvement in every decision.**

In Observer's model: "AI articulates, Human decides." In Agent Teams' model: human instructs lead, lead instructs teammates, lead approves/rejects teammate plans autonomously. Human authority is **mediated**, not direct.

This is not a flaw — it is the mechanism that makes parallel work possible. But it creates a governance gap that must be acknowledged and addressed.

### Three Governance Models for Agent Teams

#### Model 1: Fixed Council (Observer's Current Model, Extended)

Assign each Agent Team teammate a fixed Council role: one Clarifier, one Architect, one Sentry, lead as Gatekeeper proxy. The roles are static for the team's lifetime.

| Aspect | Assessment |
|--------|------------|
| **Cognitive diversity** | Guaranteed by role assignment — each agent has a structurally distinct perspective |
| **Angular separation** | High initially, but fixed roles can calcify into ritual rather than genuine disagreement |
| **Risk** | Role assignment is the team lead's autonomous decision — what governance constrains THAT choice? |
| **Agent Teams compatibility** | Awkward. Agent Teams' strength is flexible parallel work; fixed roles add rigidity that the substrate doesn't require |
| **Convergence risk** | Low for adversarial roles (Sentry), high for collaborative roles (Clarifier + Architect may converge) |

#### Model 2: Constraint-Driven Composition (Constitution as Team Shaper)

Instead of fixed roles, define constitutional constraints that team composition must satisfy. Examples: "at least one adversarial perspective," "no two teammates with identical prompt framing," "verification cannot be performed by the agent that produced the work."

| Aspect | Assessment |
|--------|------------|
| **Cognitive diversity** | Enforced by constraint, not role. The constraint "at least one adversarial perspective" admits many implementations |
| **Angular separation** | Depends on constraint quality. Good constraints produce genuine angular separation; vague constraints produce token compliance |
| **Risk** | Constraint enforcement is itself a governance problem — who verifies that the lead's team composition satisfies constraints? |
| **Agent Teams compatibility** | Natural. Constraints shape team composition without dictating it. The lead has freedom within boundaries. |
| **Convergence risk** | Medium — constraints can prevent structural convergence but cannot prevent semantic convergence (agents agreeing for different stated reasons) |

#### Model 3: Task-Shaped Teams (Dynamic Composition per Task)

Teams are composed fresh for each task based on the task's requirements, with no persistent team identity. A research task gets researchers. A security task gets a red team and a builder. An architecture task gets a council.

| Aspect | Assessment |
|--------|------------|
| **Cognitive diversity** | Depends on the task decomposition — if tasks are decomposed narrowly, diversity is lost |
| **Angular separation** | Low by default — agents shaped by the same task tend to converge. Must be intentionally introduced through prompt divergence |
| **Risk** | Who decomposes the task? The lead. What governs the lead's decomposition? This is recursive — the lead's framing shapes everything downstream |
| **Agent Teams compatibility** | Perfect. This IS how Agent Teams naturally work — the lead creates a team for a task and cleans up afterward |
| **Convergence risk** | Highest. Without structural divergence, agents will optimize for the same objective in similar ways |

### Preserving Cognitive Diversity: The Angular Separation Problem

The deepest governance concern is not authority or approval flow — it is **convergence**. When multiple agents share the same model, the same context loading (CLAUDE.md), and similar prompts, they tend toward the same conclusions through different words.

Observer's philosophy demands angular separation (≈90°) — perspectives that are genuinely orthogonal, not cosmetically different. Agent Teams' architecture works against this:

- All teammates load the same CLAUDE.md
- All teammates use the same model (unless explicitly varied)
- The lead's framing in spawn prompts shapes all teammates' thinking
- Teammates can message each other, which accelerates convergence

**Mechanisms that could preserve angular separation:**

1. **Prompt divergence at spawn** — different system prompts, different personas, different evaluation criteria per teammate
2. **Information asymmetry** — deliberately withholding certain context from certain teammates so their perspectives are genuinely independent
3. **Model diversity** — using different model tiers (Sonnet for some, Opus for others) introduces actual cognitive variation
4. **Adversarial mandate** — at least one teammate is structurally required to argue against the emerging consensus
5. **Delayed convergence** — teammates work independently before sharing findings; early sharing accelerates convergence
6. **External perspectives** — hooks that inject third-party analysis (other AI models, external data) to disrupt echo chambers

**What cannot be guaranteed architecturally:**

- That agents will genuinely disagree rather than perform disagreement
- That the lead will faithfully represent adversarial findings rather than smoothing them
- That prompt divergence produces genuinely orthogonal perspectives rather than superficially different framings

These limitations suggest that **human review of team outputs must include assessment of genuine diversity, not just presence of multiple agents.**

### The Team Lead Governance Gap

The team lead's autonomous authority is the most significant governance challenge:

| Lead Decision | Currently Governed By | Gap |
|---------------|----------------------|-----|
| Team composition | Lead's judgment + user prompt | No constitutional constraint on composition quality |
| Task decomposition | Lead's judgment | No verification that decomposition preserves intent |
| Plan approval/rejection | Lead's judgment + user-provided criteria | Lead approves teammate plans without human review |
| Work synthesis | Lead's judgment | No verification that synthesis faithfully represents teammate findings |
| Teammate shutdown | Lead's judgment | Lead can silence a dissenting teammate |

**Possible mitigations:**

- **Delegate mode** — restricts lead to coordination only, no implementation; available today
- **Plan approval escalation** — for tasks above a risk threshold, teammate plans escalate to human rather than lead
- **Hooks as enforcement** — `TeammateIdle` and `TaskCompleted` hooks can enforce quality gates, run verification, or require human sign-off
- **Constitutional criteria in lead prompt** — "only approve plans that satisfy [specific principles]" shapes the lead's autonomous decisions
- **Post-team human review** — all Agent Team outputs go through human verification before they affect canonical state; the team's work is a proposal, not a decision

---

## 3. Cognition Strategy

### The Oscillation Problem

Both systems recognize the need for structured and unstructured thinking, but approach it differently:

| Dimension | Observer | PAI |
|-----------|----------|-----|
| **Unstructured input** | Signal layer — unconstrained human intuition | BeCreative thinking tool — extended divergent thinking |
| **Structured processing** | Council deliberation with fixed roles | Algorithm phases (OBSERVE through LEARN) with ISC criteria |
| **Transition mechanism** | Signal → Translation → Proof (manual, human-mediated) | Hook detection → capability selection → verification (automated) |
| **Creative protection** | "Signal is never authoritative but allowed to be unconstrained" | "BeCreative: 5 diverse options, avoiding obvious/first answers" |
| **Convergence gate** | Proof layer — only verified artifacts change state | VERIFY phase — ISC criteria must pass |

**The design space for a future system includes three dimensions:**

### Dimension 1: Cognitive Role Implementation

**Fixed Identities** (Observer's model):
- Clarifier, Architect, Sentry are stable roles with defined constraints
- Pros: Predictable, testable, institutional memory across invocations
- Cons: Rigid, roles may not match problem shape, can become ritualistic

**Parameterized Perspectives** (a middle ground):
- "Think as a security engineer," "Think as a user advocate," "Think as a cost optimizer"
- Perspectives are parameters, not identities — the same agent can adopt different framings
- Pros: Flexible, task-appropriate, low overhead
- Cons: Shallow — a parameterized perspective lacks the depth of a genuine role with institutional knowledge

**Dynamically Instantiated Framings** (Agent Teams' natural model):
- Each teammate receives a unique framing at spawn time, shaped by the task
- Framings are disposable — they exist for one team invocation and are not preserved
- Pros: Maximum flexibility, no legacy role baggage
- Cons: No continuity, no institutional learning, hard to verify angular separation

**No recommendation is made here.** Each approach has a valid use case, and hybrid models (fixed roles for governance, dynamic framings for execution) are possible.

### Dimension 2: Structured/Unstructured Oscillation

The critical insight from both systems: **structured thinking without unstructured input becomes formulaic; unstructured thinking without structured verification becomes ungrounded.**

Possible implementation patterns:

1. **Phase-gated oscillation** — structured phases with explicit "diverge" gates where unstructured exploration is invited before convergence. PAI's OBSERVE→THINK transition is partially this, but the Algorithm's rigidity limits genuine divergence.

2. **Parallel-track oscillation** — structured and unstructured work happen simultaneously in different Agent Team teammates. One teammate follows the plan; another explores freely. Findings are synthesized by the lead. This leverages Agent Teams' parallelism for cognitive diversity.

3. **Interrupt-driven oscillation** — structured execution proceeds until a signal (anomaly, failure, human input) triggers unstructured exploration. This is closest to Observer's "Reality Patch" concept — evidence contradicts assumptions, so execution halts and thinking mode shifts.

4. **Loop-based oscillation** — inspired by PAI's "Science as Cognitive Loop": hypothesize → test → observe → revise. Each loop iteration alternates between structured (test) and unstructured (hypothesize/observe). Agent Teams could implement this as alternating team compositions.

### Dimension 3: Adversarial Perspective Guarantee

Adversarial perspectives must be **guaranteed, not accidental.** Both systems acknowledge this but implement it weakly:

- Observer's Sentry is structurally adversarial but its effectiveness depends on prompt quality
- PAI's RedTeam thinking tool is opt-out but is a single-pass analysis, not ongoing adversarial engagement

**Stronger guarantees under Agent Teams:**

- **Structural adversary** — one teammate whose ONLY job is to argue against the emerging consensus. Not a role that also has constructive responsibilities.
- **Adversarial hooks** — `TaskCompleted` hook runs an adversarial analysis before allowing task completion. This is automated adversarial verification, not a team role.
- **Delayed synthesis** — findings are not synthesized until all teammates (including adversaries) have completed. The lead cannot smooth over disagreement during synthesis if the raw outputs are preserved.
- **Adversarial receipt** — the adversary's findings are included in the final receipt regardless of whether the lead agrees. Human sees both the consensus and the dissent.

---

## 4. Verification & Receipts Strategy

### The Agent Teams Verification Challenge

Agent Teams fundamentally change the verification landscape:

| Single Session | Agent Teams |
|----------------|-------------|
| One context, one actor | Multiple contexts, multiple actors |
| Linear execution trail | Parallel execution with coordination |
| One receipt per task | Multiple partial receipts per task |
| Human reviews one output | Human reviews synthesized output from multiple agents |
| Verification is self-directed | Verification can be cross-agent |

### Receipt Granularity Models

#### Model 1: Per-Agent Receipts

Every teammate produces a receipt for their assigned work. The lead produces a synthesis receipt. The human sees all of them.

| Pro | Con |
|-----|-----|
| Maximum transparency — every agent's work is individually auditable | Receipt explosion — a 5-agent team on a 6-task project produces 30+ receipts |
| Individual agent failures are visible, not hidden in synthesis | Human cognitive load scales with team size |
| Aligns with Observer's "steps are visible, results are verifiable" | May incentivize minimal receipts to reduce volume |

#### Model 2: Per-Team Receipts

One receipt per team invocation. The lead produces it, summarizing all teammates' work.

| Pro | Con |
|-----|-----|
| Manageable volume — one receipt regardless of team size | Lead's synthesis is itself an unverified interpretation |
| Matches how humans actually review work (summary, then detail on demand) | Individual agent failures can be hidden in synthesis |
| Lower friction for simple tasks | Contradicts Observer's "no output is trusted unless steps are visible" |

#### Model 3: Per-Task Receipts

Receipts map to the shared task list, not to agents. One receipt per completed task, regardless of how many agents contributed.

| Pro | Con |
|-----|-----|
| Receipt structure mirrors work structure | Task boundaries are the lead's decomposition choice — governance concern |
| Natural integration with Agent Teams' task list | Cross-task work (agent finds something relevant to another task) is invisible |
| Verification is task-scoped, which matches ISC criteria granularity | If a task is reassigned from one agent to another, the receipt chain is fragmented |

#### Model 4: Hierarchical Receipts

Team receipt at the top, with per-agent sub-receipts available on demand. Default view is the team receipt; drill-down reveals individual agent work.

| Pro | Con |
|-----|-----|
| Balances transparency with cognitive load | More complex receipt structure to maintain |
| Human can audit at the level of detail they need | The "default view" choice shapes what actually gets reviewed |
| Preserves Observer's "steps visible" principle without imposing it on every interaction | Sub-receipts may not be reviewed unless a problem is suspected — post-hoc auditability, not active verification |

**No model is clearly superior.** The choice depends on the priority weighting between transparency, friction, and human cognitive capacity. A graduated approach — Model 2 for low-risk tasks, Model 4 for high-risk tasks — is plausible but adds complexity.

### Verification Without Bureaucracy

Observer's Airlock pattern (Plan→Preview→Approve→Apply→Verify→Receipt) is thorough but high-friction. Under Agent Teams, if every teammate's every action goes through full Airlock, the system becomes unusable.

**Possible graduated approaches:**

1. **Risk-graduated verification** — low-risk agent actions (reading, researching, analyzing) require minimal verification; high-risk actions (writing code, modifying files, external communication) require full Airlock. Maps to AMB-01's "moderate" interpretation: when in doubt, it's risky.

2. **Cross-agent verification** — teammates verify each other's work before it reaches the lead. This leverages Agent Teams' peer messaging. Risk: agents from the same model may "verify" by agreeing rather than genuinely testing.

3. **Hook-enforced verification** — `TaskCompleted` hooks run automated checks (tests pass, diff is within scope, no secrets committed) before allowing task completion. This moves verification from process to automation, reducing friction without hiding intent.

4. **Lead-as-verifier** — the lead verifies all teammate outputs before synthesizing. This adds a verification layer but concentrates trust in the lead, which is itself the governance gap identified above.

5. **Human verification at team boundary only** — teammates and lead operate with agent-level verification internally; human verification applies only to the team's final output. This is the lowest-friction model but creates the largest "black box" — the team's internal work is trusted by default.

### Receipts and the C Compiler Lesson

The C compiler case study revealed a critical insight: **"When a human sits with Claude during development, they can ensure consistent quality... For autonomous systems, it is easy to see tests pass and assume the job is done, when this is rarely the case."**

This directly challenges any verification model that relies solely on automated checks. Passing tests — even comprehensive tests — proved insufficient for production code. The governance implication: **verification must include human judgment, not just automated gates**, especially for work produced by autonomous agent teams.

---

## 5. Constitutional Conflicts as Policy Gates

The 7 documented conflicts must NOT be resolved architecturally. They represent genuine value tensions that require human judgment in specific contexts. The architecture's job is to make conflicts visible, not invisible.

### Pattern: Conflict as Runtime Policy Gate

When an agent action touches a domain governed by a constitutional conflict, execution pauses and the conflict is surfaced.

**Mechanism:**
1. Agent proposes an action
2. Action is evaluated against the constitutional principles (automated where possible, human judgment where necessary)
3. If the action falls within a conflicted domain (e.g., "block a risky operation" touches CONF-07), the conflict is surfaced with both positions cited
4. Human resolves for THIS instance — not permanently
5. The resolution is recorded as a receipt (conflict ID, context, which position was chosen, who decided, when)
6. The resolution does NOT set precedent unless explicitly promoted to policy

**Example — CONF-01 (Security vs Human Authority):**

> A teammate proposes force-pushing to a repository. The lead's autonomous approval would normally evaluate this against security principles. But CONF-01 means there are two valid readings: (A) security forbids this regardless of human instruction, or (B) human authority overrides security if the human explicitly agrees.
>
> The policy gate surfaces: "This action touches CONF-01. Security and Human Authority conflict on force-push. Option A: block. Option B: allow with explicit human override. Requesting human decision."
>
> Human decides for this instance. Receipt records the decision.

### Pattern: Conflict Registry as First-Class Component

The conflict registry is not a document to be read — it is a runtime component that is consulted by governance logic.

**Properties:**
- Each conflict has a machine-readable ID (CONF-01 through CONF-07)
- Each conflict has defined trigger conditions (what actions or decisions fall within its scope)
- Each conflict has the competing positions stated (both sides, with citations)
- Each conflict has a resolution history (previous human decisions in similar contexts, if any)
- No conflict has a default resolution (defaults would constitute silent conflict resolution)

### Pattern: Per-Session Conflict Policy

For a given session or project, the human can pre-resolve specific conflicts: "For this project, CONF-01 resolves as Option B (human authority can override security with explicit acknowledgment)." This reduces friction for repeated decisions without permanently resolving the conflict.

**Constraint:** Session policies must be explicitly set and explicitly scoped. They do not propagate to other sessions. They are recorded as receipts.

### What This Means for Agent Teams

Agent Teams amplify conflict risk because the lead makes autonomous decisions that may touch conflicted domains without surfacing them. If the lead auto-approves a teammate's plan that involves a CONF-01 action, the conflict is never surfaced.

**Mitigations:**
- Conflict detection hooks that evaluate teammate plans against the conflict registry before lead approval
- Lead prompt instructions that enumerate known conflicts and require escalation when they are relevant
- Post-team human review that explicitly checks whether any conflict domains were touched

### Non-Exploitability Requirement

Conflicts must not be exploitable by agents. Two failure modes:

1. **Playing both sides** — an agent cites whichever position of a conflict supports its preferred action. Mitigation: conflicts always surface BOTH positions; the agent cannot choose.
2. **Conflict avoidance** — an agent frames its action to avoid triggering conflict detection. Mitigation: conflict triggers must be broad enough to catch edge cases, and humans review for missed conflicts.
3. **Resolution shopping** — an agent re-raises a conflict in a different context hoping for a different resolution. Mitigation: resolution history is visible, and the human can see that this conflict has been decided before.

---

## 6. Explicit Open Questions

### Questions Requiring Human Decision

**Q1: System direction** — Which of the four options (or a hybrid) should be pursued? This is the foundational decision from which all others follow. It cannot be made by analysis alone.

**Q2: Seven constitutional conflicts** — Should any be resolved before architectural work begins? Some conflicts (particularly CONF-01/CONF-05 on Security vs Human Authority) may need at least a working interpretation to proceed with governance design.

**Q3: Agent Teams' governance boundary** — Should the team lead's autonomous approval authority be constrained, and if so, how? Current options: delegate mode (lead coordinates only), hook enforcement, escalation thresholds, or unrestricted lead authority with post-hoc review.

**Q4: Receipt granularity** — Which receipt model (per-agent, per-team, per-task, hierarchical) matches the priority weighting between transparency and friction? This is a values question, not an engineering question.

**Q5: Observer's constitution-readiness** — If Option D (two-repo) is pursued, which of Observer's 66+ documents are constitutional and which are operational? The RESTORE-phase documents are a mix; clarifying this is preparatory work that must precede the architectural decision.

**Q6: PAI Algorithm survival** — Does the 7-phase Algorithm (OBSERVE→LEARN) survive into the new system, get abstracted into a more general cognitive loop, or get replaced entirely by Agent Teams' task-based coordination? The Algorithm is deeply embedded in PAI's identity but may be too rigid for the new system's needs.

**Q7: Semantic space** — CONF-04 defers semantic space concepts. But the new system's design could either leave space for them or foreclose them. A human must decide whether semantic space is a constraint on future architecture or a fully deferred concept that imposes no current constraints.

### Questions That Cannot Be Answered Without Prototyping

**P1: Angular separation effectiveness** — Can prompt divergence at Agent Team spawn time produce genuinely orthogonal perspectives, or do agents from the same model converge regardless of framing? This is an empirical question.

**P2: Lead governance in practice** — Does the team lead faithfully represent adversarial findings in synthesis, or does it smooth over disagreement? This requires observing actual team behavior.

**P3: Hook enforcement reliability** — Do `TeammateIdle` and `TaskCompleted` hooks fire reliably enough to serve as governance mechanisms? Agent Teams documentation notes known limitations around session resumption and task status lag.

**P4: Receipt friction threshold** — At what point does receipt-generation friction cause agents (or humans) to circumvent verification rather than comply with it? Observer's anti-success indicator — "governance becoming bureaucratic friction" — applies here.

**P5: Cross-agent verification quality** — When teammates verify each other's work, is this genuine verification or performative agreement? The C compiler case study suggests automated checks alone are insufficient.

**P6: Constitutional compliance automation** — How much of Observer's 97 principles can be enforced through automated checks (hooks, tests, linting) versus requiring human judgment? This determines the practical governance overhead.

### Assumptions Made in This Document That Need Validation

- Agent Teams' research preview is stable enough to build governance around (it may change significantly before GA)
- The team lead's behavior can be meaningfully shaped by prompt instructions and hooks (it may be more or less controllable than assumed)
- The 7 constitutional conflicts are genuinely unresolvable rather than being resolvable with more information
- A single human (Adam) is the sole authority — this document does not address multi-human governance
- Observer and PAI's source documents accurately represent their intended designs (some may be aspirational, outdated, or inconsistent with actual implementation)

---

## Summary

This document does not choose a path. It maps the territory.

**The strongest structural insight:** The constitution's directive — "evaluated AGAINST, not derived FROM" — is a design constraint that meaningfully distinguishes the options. Options A and B violate it structurally. Option C is ambiguous. Option D honors it explicitly.

**The deepest governance concern:** Agent Teams' team lead makes autonomous decisions that mediate human authority. This is not a flaw but a governance gap that every model must address. The gap is largest for convergence (agents agreeing too easily) and synthesis (lead smoothing over dissent).

**The most uncertain area:** Whether architectural mechanisms (prompt divergence, adversarial mandates, hooks) can produce genuine cognitive diversity when agents share the same underlying model. This is an empirical question that requires prototyping.

**What is clear regardless of path chosen:**
- Human authority must be preserved, not just formally but practically
- Verification must include human judgment, not just automated checks
- Constitutional conflicts are policy gates, not resolution targets
- Receipts must exist at some granularity — the question is which
- Angular separation must be intentional, not assumed
- Agent Teams are a substrate, not a governance model

---

**Sources consulted:**
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Building a C Compiler with Agent Teams](https://www.anthropic.com/engineering/building-c-compiler)
- [Anthropic Opus 4.6 Announcement](https://www.anthropic.com/news/claude-opus-4-6)
- Observer codebase at `/srv/observer/observer-workspace` (44 documents)
- PAI system at `~/.claude/skills/PAI/` (21 SYSTEM documents)
- Draft Constitution at `/home/adam/vault/workspaces/observer/constitutional-synthesis-2026-02-10/`
