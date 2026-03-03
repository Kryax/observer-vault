---
status: DRAFT
created: 2026-03-03
session: evening
vault_safety: Raw triad output. Evidence chain incomplete — see caveats. Do not promote motifs based on this without evidence-locked rerun.
---

# Alien-Domain Triad Run — Raw Output (2026-03-03 Evening)

## Status: INCOMPLETE — Stalled at Reflect Phase (75% context)

The O&G and C&E phases completed. The Reflect phase did not execute before context exhaustion. Findings below are from the Oscillate and Converge phases only.

## CAVEAT: Evidence Drift

GPT advisory flagged that this run cited repos NOT verified as present in the 203-record OCP corpus. Only 5 repos were actually ocp_inspected: Godot, Bevy, FSRS4Anki, Nextflow, Zrythm. Additional repos cited from general knowledge (GATK, ColabFold, fastp, A-Frame, GDevelop, libGDX, OpenRA) need verification before instances can be committed to motif files.

**Action required:** Evidence-locked rerun where every instance cites an ocp:github/ record ID from an inspected record.

---

## Corpus

- 203 total records in OCP index
- 112 infrastructure/devtools repos (from first scrape batch)
- 91 alien-domain repos: bioinformatics (20), spaced repetition (20), game engines (20), legal tech (11), music production (20)

## Phase 1: OscillateAndGenerate — 5×5 Motif × Domain Matrix

### Dual-Speed Governance × Alien Domains

**Game Engines — STRUCTURAL ✅**
- Bevy (ocp:github/bevyengine--bevy): App::new() at startup defines full system configuration — plugins, resources, schedules, state transitions (SLOW). ECS update loop runs systems every frame at 60+ fps (FAST). Startup configuration constrains what systems exist; frame loop executes autonomously within those constraints.
- Godot (ocp:github/godotengine--godot): Editor/addon development and asset store review (SLOW). Game runtime ticking scene tree at physics/render speed (FAST). GDExtension/EditorPlugin interfaces defined at governance speed; runtime execution autonomous.
- Falsification: Two speeds ARE coupled — Bevy's startup schedule constrains update schedule. Structural.

**Bioinformatics — STRUCTURAL ✅**
- Nextflow (ocp:github/nextflow-io--nextflow): Pipeline DSL definition and peer review (SLOW). Task execution on HPC/cloud (FAST). Workflow DAG constrains what tasks exist; execution autonomous within DAG.
- GATK (⚠️ NOT VERIFIED IN CORPUS): Walker/tool definitions (SLOW) vs per-read data traversal (FAST).
- Falsification: Nextflow's DSL-to-execution split has genuine coupling. Structural.

**Spaced Repetition — STRUCTURAL ✅**
- FSRS4Anki (ocp:github/open-spaced-repetition--fsrs4anki): Algorithm parameter optimization via ML (SLOW — runs periodically). Per-review scheduling decisions (FAST — compute next interval in milliseconds). Optimized parameters constrain fast scheduling function.
- Falsification: Optimizer output directly constrains scheduler behavior. Structural.

**Music Production — STRUCTURAL ✅**
- Zrythm (ocp:github/zrythm--zrythm): Project configuration — signal routing, plugin chain, automation curves (SLOW). Real-time audio rendering at sample rate 44.1/48kHz (FAST). Automation curves = slow governance of fast DSP parameters.
- Falsification: Removing slow config layer would mean reconfiguring routing at sample rate — impossible. Structural. Strong.

**Legal Tech — NOT STRUCTURAL ❌**
- 11 repos too application-thin. Insufficient evidence, not proven absence.

---

### Composable Plugin Architecture × Alien Domains

**Game Engines — STRUCTURAL ✅**
- Bevy: ENTIRE engine composed of plugins. Even default functionality (rendering, input, audio) is a plugin. Core = ECS scheduler + plugin loader.
- Godot: GDExtension, EditorPlugin, addon system.
- A-Frame (⚠️ NOT VERIFIED), GDevelop (⚠️ NOT VERIFIED)

**Bioinformatics — STRUCTURAL ✅ (MODERATE)**
- Nextflow: Each process is composable unit with defined I/O channels. Core handles execution; processes handle domain logic.
- GATK (⚠️ NOT VERIFIED): Walker framework where each tool is a plugin.
- GPT caveat: Pipeline stages ≠ plugin interfaces in the strict sense. Moderate, not strong.

**Music Production — STRUCTURAL ✅ (STRONGEST POSSIBLE)**
- Zrythm: Supports 7 plugin standards (LV2, CLAP, VST2, VST3, AU, LADSPA, DSSI). DAW IS a plugin host. Core contains no audio processing — ALL comes from composed plugins. Optional sandboxing proves plugin independence.
- Falsification: Removing plugin architecture would destroy the DAW. Strongest instance across all domains.

**Spaced Repetition — SUPERFICIAL ⚠️ → DISCARDED**
- Obsidian SR Plugin is a plugin IN Obsidian, but SR as a domain doesn't use composable plugins. Meta-level confusion.

**Legal Tech — NOT STRUCTURAL ❌**

---

### Explicit State Machine Backbone × Alien Domains

**Game Engines — STRUCTURAL ✅ (STRONGEST)**
- Godot: First-class AnimationStateMachine node. Game state enums (Menu→Loading→Playing→Paused→GameOver).
- Bevy: States derive macro with guarded transitions. Invalid transitions are compile-time errors.
- libGDX (⚠️ NOT VERIFIED), OpenRA (⚠️ NOT VERIFIED)

**Spaced Repetition — STRUCTURAL ✅**
- FSRS4Anki: Card states explicitly enumerated: New→Learning→Review→Relearning. Transitions guarded by answer ratings. Cannot skip states. State machine IS the core data structure.
- LibreLingo (⚠️ NOT VERIFIED): Skill tree with progressive states.

**Bioinformatics — STRUCTURAL ✅ (MODERATE)**
- Nextflow: Task states PENDING→SUBMITTED→RUNNING→COMPLETED|FAILED|CACHED. Guarded transitions. -resume reads state machine for re-execution.

**Music Production — STRUCTURAL ✅ (MODERATE)**
- Zrythm: Transport state machine Stopped→Playing→Recording→Paused. Cannot Record without Playing first.

**Legal Tech — NOT STRUCTURAL ❌**

---

### Bounded Buffer With Overflow Policy × Alien Domains

**Music Production — STRUCTURAL ✅ (CANONICAL)**
- Zrythm: Audio buffers ARE bounded buffers. Buffer size (256-2048 samples) is first-class config. Overflow = audio glitch. Latency-vs-stability IS the overflow policy. Predates modern software infrastructure (1980s digital audio).

**Bioinformatics — STRUCTURAL ✅**
- Nextflow: Channels between processes are bounded queues with configurable backpressure. Essential for 100GB+ genomic datasets.
- fastp (⚠️ NOT VERIFIED): Thread-based I/O with bounded buffers.

**Game Engines — MODERATE ✅ (SECONDARY)**
- Bevy: ECS event queues bounded with 2-frame TTL. Events expire after TTL = explicit overflow policy. Real but secondary — not the defining architectural choice.

**Spaced Repetition — SUPERFICIAL ⚠️ → DISCARDED**
- Daily review limits = UX scheduling, not architectural buffer management.

**Legal Tech — NOT STRUCTURAL ❌**

---

### Idempotent State Convergence × Alien Domains

**Bioinformatics — STRUCTURAL ✅ (STRONG)**
- Nextflow: -resume flag = textbook idempotent convergence. Re-running converges to same outputs. Completed tasks skipped. Safe no-op on re-application.
- ColabFold (⚠️ NOT VERIFIED): Caches intermediate predictions. Re-running converges to cached result.

**Game Engines — NOT STRUCTURAL ❌**
- Real-time simulation with player input is inherently non-deterministic. Game ticks accumulate side effects by design.

**Spaced Repetition — NOT STRUCTURAL ❌**
- Each review CHANGES card state. Intentionally non-idempotent.

**Music Production — NOT STRUCTURAL ❌**
- Deterministic rendering ≠ convergence. No convergence loop.

**Legal Tech — NOT STRUCTURAL ❌**

---

## Phase 2: ConvergeAndEvaluate — Survival Assessment

### Summary Table

| Motif | Alien Domains (structural) | Total Domains | Threshold Met (3+ incl alien) |
|-------|---------------------------|---------------|-------------------------------|
| Dual-Speed Governance | 4 (games, bio, SR, music) | 12 | ✅ STRONG |
| Composable Plugin Architecture | 3 (games, music, bio-moderate) | 7 | ✅ |
| Explicit State Machine Backbone | 3 (games, SR, music-moderate) | 7 | ✅ |
| Bounded Buffer With Overflow Policy | 3 (music-canonical, bio, games-secondary) | 7 | ✅ |
| Idempotent State Convergence | 1 (bio only) | 5 | ⚠️ WEAK — domain-constrained |

### Discarded Superficial Matches
1. Spaced repetition as "composable plugin" — Obsidian's architecture, not SR's
2. Spaced repetition as "bounded buffer" — daily limits are UX scheduling

### Key Residuals
- Legal tech failure = data quality (11 low-star repos), not domain absence
- Idempotent Convergence weakness = genuine domain constraint (pipeline/declarative systems only)
- Bioinformatics Composable Plugin = moderate, pipeline stages ≠ strict plugin interfaces

---

## Emergent Meta-Observation: Problem-Shaped vs Engineer-Shaped

**New candidate classification axis (NOT YET A MOTIF — needs formalisation)**

Motifs reflecting inherent properties of the PROBLEM domain travel further across alien domains than motifs reflecting ENGINEERING preferences.

| Motif | Shape | Why |
|-------|-------|-----|
| Dual-Speed Governance | Problem-shaped | Systems with two natural timescales demand this |
| Bounded Buffer | Problem-shaped (physics domains) | Hardware constraints mandate bounded resources |
| Composable Plugin | Engineer-shaped | Engineering choice for extensibility |
| Explicit State Machine | Mixed | Problem-shaped in SR (cognitive stages), engineer-shaped in games |
| Idempotent Convergence | Engineer-shaped (domain-bound) | Only pipeline/declarative systems benefit |

### Predictions (falsifiable)
1. Dual-Speed Governance should appear in ANY system with two natural timescales (robotics, trading, education platforms)
2. Idempotent Convergence should NOT appear in interactive/creative/real-time domains
3. Composable Plugin should be strongest where user intent varies most (DAWs, game engines, IDEs)

### Fractal potential
The distinction itself may be a meta-motif: "patterns reflecting problem structure travel further than patterns reflecting solution structure."

---

## Phase 3: Reflect — NOT EXECUTED

Context exhaustion at 75%. Reflect phase needs to be run in fresh session with these findings as input.

---

## Next Steps

1. Evidence-locked rerun: verify all cited repos exist in corpus via ocp_inspect
2. Fix OCP search retrieval so keyword queries find scraped repos
3. Run Reflect phase against these findings
4. Update motif files with ONLY verified instances
5. Assess Tier 2 promotion readiness for the 4 bottom-up motifs
