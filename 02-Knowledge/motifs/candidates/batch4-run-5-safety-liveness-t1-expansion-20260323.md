---
title: "Batch 4 Run 5: Safety-Liveness Duality — T0 Domain Count Fix + Alien Expansion"
date: 2026-03-23
status: draft
source: ocp-scraper (SEP) + domain knowledge
target_motif: safety-liveness-duality
target_gap: "T0 with 2 domains listed but domain_count: 1 — fix + expand to T1"
---

# Batch 4 Run 5: Safety-Liveness Duality — T1 Promotion + Alien Domain Expansion

## Status Assessment

Safety-Liveness Duality (SLD) is T0 with `domain_count: 1` in frontmatter but actually has 2 instances listed (Control Theory and Distributed Systems). This is a bookkeeping error — it should already be T1 (auto-promotes at 2+ unrelated domains). Expanding to make the T1 case unambiguous and build toward T2 readiness.

## Scrape Results

### SEP Scrape: "safety liveness property verification distributed systems"
- `ocp:sep/logic-temporal` (0.656) — Temporal Logic (safety/liveness properties formalized here)
- `ocp:sep/property` (0.658) — Property and Ownership (not relevant)
- `ocp:sep/computation-physicalsystems` (0.569) — Computation in Physical Systems
- `ocp:sep/natural-deduction` (0.605) — Natural Deduction Systems

The SEP scraper picked up temporal logic, which is exactly where safety/liveness was formally defined (Alpern & Schneider 1985). Other results are tangential.

---

## New Domain Instances

### Instance 3: Formal Verification / Temporal Logic — The Canonical Formalisation
- **Domain:** Formal Methods / Computer Science Theory
- **Expression:** Alpern and Schneider (1985) proved that every temporal property of a program can be decomposed into a safety property ("nothing bad ever happens") and a liveness property ("something good eventually happens"). This is not a design choice — it is a mathematical decomposition theorem. Every specification IS a conjunction of safety and liveness requirements.

  The duality is load-bearing: model checkers must verify safety (invariant checking, reachability analysis — decidable for finite state) and liveness (fairness constraints, progress requirements — requires different algorithms) using different techniques. Safety violations have finite counterexamples (a specific trace that reaches a bad state). Liveness violations require infinite traces (the system never makes progress). The structural asymmetry between the two constraint types forces different verification strategies.
- **Discovery date:** 2026-03-23
- **Source:** bottom-up (`ocp:sep/logic-temporal` — SEP entry covers the Alpern-Schneider decomposition theorem and its verification implications)
- **Structural fit:** Canonical. This is where the duality was formally proven to be exhaustive and universal. Every temporal property is safety ∩ liveness.

### Instance 4: Medical Ethics — Nonmaleficence vs. Beneficence
- **Domain:** Medical Ethics / Bioethics
- **Expression:** The Hippocratic tradition embodies the duality: "First, do no harm" (primum non nocere — safety) versus "Act for the patient's benefit" (beneficence — liveness). These are dual constraints on the same action space (clinical decision-making). When they conflict — an aggressive treatment that risks harm but offers cure — safety dominates in conservative medical practice (the precautionary principle).

  The duality is structural, not merely rhetorical:
  - Safety (nonmaleficence) is a constraint on what must NOT happen: do not cause death, do not cause unnecessary suffering, do not worsen the condition
  - Liveness (beneficence) is a requirement for what MUST happen: cure the disease, relieve suffering, restore function
  - When resources are limited (ICU beds, organ transplants), the tension is acute — triaging is precisely the resolution of safety-liveness conflict under resource constraint

  The Beauchamp and Childress "four principles" framework (autonomy, beneficence, nonmaleficence, justice) encodes the duality as two of its four principles. Medical institutional review boards (IRBs) embody the priority ordering: safety (risk to subjects) dominates liveness (research progress).
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in bioethics literature)
- **Structural fit:** Strong. The duality maps precisely: nonmaleficence = safety constraint, beneficence = liveness requirement, safety dominates when they conflict. The domain is genuinely alien to computer science.

### Instance 5: Constitutional Law — Rights vs. Powers (Negative vs. Positive Liberty)
- **Domain:** Constitutional Law / Political Philosophy
- **Expression:** Constitutional design faces a structural duality: negative rights ("the state must NOT do X" — safety) and positive powers ("the state MUST do Y" — liveness). A constitution that only constrains (pure safety) produces a state that cannot act. A constitution that only empowers (pure liveness) produces a state with no limits. Functional constitutions resolve the tension: the Bill of Rights (safety constraints) operates alongside Article I Section 8 enumerated powers (liveness requirements).

  Isaiah Berlin's negative/positive liberty distinction captures the same structure at the individual level: negative liberty (freedom FROM interference — safety) vs. positive liberty (freedom TO achieve goals — liveness). Berlin argued that the two cannot be fully reconciled — they are genuinely dual constraints on the same policy space.

  Safety dominates in constitutional design: amendments are easier to block than to pass (supermajority requirements), judicial review can strike down legislation (safety enforcement), and constitutional crises are typically resolved by constraining power rather than expanding it.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in constitutional theory and Berlin's liberty framework)
- **Structural fit:** Strong. The duality is structural (not just a design preference), the constraints compete for the same action space (state power), and safety dominates when they conflict (constitutional constraints override legislative action).

### Instance 6: Ecology — Conservation vs. Exploitation
- **Domain:** Ecology / Resource Management
- **Expression:** Sustainable resource management faces the duality: do not deplete the resource below recovery threshold (safety — maximum sustainable yield boundary) and extract sufficient value to justify management (liveness — minimum viable harvest). The duality is quantifiable: the safety boundary is the stock level below which recruitment failure occurs; the liveness boundary is the harvest level below which the fishery is economically unviable.

  When they conflict (the fish stock is near depletion but the fishing community depends on harvest), safety dominates in well-managed systems: fishing moratoriums, seasonal closures, catch limits. The collapse of the Atlantic cod fishery (1992) illustrates what happens when liveness (maintaining harvest) overrides safety (maintaining stock) — the system crashes.

  The Precautionary Principle in environmental policy is the explicit institutional embodiment of "safety dominates": when uncertain, constrain action rather than permit it.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in resource management theory)
- **Structural fit:** Strong. The duality is quantifiable, the constraints compete for the same action space (harvest decisions), and safety-dominant systems outperform liveness-dominant systems in the long run.

### Instance 7: Game Design — Constraint vs. Agency
- **Domain:** Game Design / Interactive Systems
- **Expression:** Game designers face the duality: prevent degenerate strategies and exploits (safety — the game must not be broken) and enable player expression and meaningful choice (liveness — the game must be fun). Rules constrain the possibility space (safety); mechanics create possibility within constraints (liveness).

  When they conflict: a player discovers an exploit that makes the game trivial — safety (patching the exploit) overrides liveness (preserving player freedom). In competitive games (chess, Go, eSports), rule integrity (safety) always dominates player preference (liveness). A game where any strategy is allowed (no safety constraints) degenerates; a game where no strategy is effective (no liveness) is inert.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge
- **Structural fit:** Moderate-strong. The duality maps well and safety dominates in practice. Weaker than the formal verification or medical instances because game design boundaries are more fluid.

---

## Updated Domain Count and Confidence

| # | Domain | Instance |
|---|--------|----------|
| 1 | Control Engineering | CBF-CLF-QP, Tube MPC |
| 2 | Distributed Systems | FLP impossibility, CAP theorem |
| 3 | Formal Verification | Alpern-Schneider decomposition theorem |
| 4 | Medical Ethics | Nonmaleficence vs. beneficence |
| 5 | Constitutional Law | Negative rights vs. positive powers |
| 6 | Ecology / Resource Management | Conservation vs. exploitation |
| 7 | Game Design | Constraint vs. agency |

**7 domains** (from 2). Confidence: 0.1 → **0.7** (0.1 start + 6 × 0.1 new domains).

## T1 Promotion

SLD should auto-promote to T1 immediately (has qualified since the original 2 domains). With 7 domains, it's a strong T1.

### Updated Frontmatter
```yaml
tier: 1
status: provisional
confidence: 0.7
domain_count: 7
source: triangulated
```

## Structural Observations

### The Decomposition Theorem Makes This Special

Most motifs are empirical observations — "we see this pattern across domains." SLD has a mathematical proof of universality: Alpern and Schneider proved that EVERY temporal property decomposes into safety ∩ liveness. This means the duality is not just frequently observed — it is mathematically necessary for any system with temporal behaviour. This is extremely rare among motif candidates.

### Safety-Dominance as Structural Invariant

Across all 7 instances, safety dominates when the two constraints conflict:
- Control theory: CBF takes priority over CLF in QP formulation
- Distributed systems: consistency over availability (in safety-prioritising protocols)
- Formal verification: safety violations are finite (easier to detect/prevent)
- Medicine: nonmaleficence over beneficence (precautionary principle)
- Constitutional law: rights constrain powers (judicial review)
- Ecology: conservation over exploitation (moratoriums)
- Game design: anti-exploit rules over player freedom

This is a strong secondary invariant: not just that the duality exists, but that safety structurally dominates. The dominance may arise from asymmetric risk: a safety violation can be catastrophic (system crash, patient death, species extinction), while a liveness violation is merely suboptimal (slow progress, missed opportunity).

## T2 Path Assessment

SLD is a strong T2 candidate due to the Alpern-Schneider theorem (mathematical universality proof). The 5-condition protocol:

1. **Domain-independent description:** PASS
2. **Cross-domain recurrence:** PASS (7 domains)
3. **Predictive power:** Strong — knowing SLD predicts that any new domain with temporal behaviour will have separable safety and liveness constraints, with safety dominating
4. **Adversarial survival:** Needs testing — is this just "trade-offs exist"? The mathematical decomposition theorem should answer this
5. **Clean failure:** PASS

**Recommendation:** Queue SLD for formal T2 validation protocol. The Alpern-Schneider decomposition theorem is a uniquely strong foundation — most T2 candidates are empirically validated; this one has a mathematical universality proof.
