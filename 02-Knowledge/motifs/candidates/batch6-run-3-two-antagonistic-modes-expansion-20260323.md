---
status: candidate
date: 2026-03-23
target_motif: Two Antagonistic Modes
batch: 6
run: 3
---

# Batch 6 Run 3 — Two Antagonistic Modes Expansion

## Target

Expand the T0 motif **Two Antagonistic Modes** (currently 1 instance: cognitive science DMN vs TPN) with 2–3 alien domain instances to test structural generality and advance toward T1.

## Method

Domain-knowledge sourcing across neuroscience, ecology, and materials science. OCP searches for "exploration exploitation tradeoff" and "antagonistic control sympathetic parasympathetic" returned zero existing records. SEP scrape for "dual process theory" yielded process-philosophy and category-theory records — tangential, not structurally matched. Instances below are drawn from established domain literature.

## Discovered Instances

### Instance 2: Autonomic Nervous System — Sympathetic vs Parasympathetic

- **Domain:** Neuroscience / Physiology
- **Expression:** The autonomic nervous system operates through two antagonistic branches: the sympathetic (fight-or-flight: elevated heart rate, bronchodilation, glucose mobilisation) and parasympathetic (rest-and-digest: reduced heart rate, enhanced digestion, tissue repair). The two branches are mutually suppressive at the effector level — sympathetic activation inhibits parasympathetic tone and vice versa. The system cannot maximally drive both simultaneously. Health requires controlled alternation: sustained sympathetic dominance produces chronic stress, hypertension, and immune suppression; sustained parasympathetic dominance produces hypotension and metabolic stagnation. The transition is regulated by brainstem nuclei (nucleus tractus solitarius, rostral ventrolateral medulla) — not a smooth blend but a governed mode-switch with hysteresis.
- **Structural alignment:** Two mutually suppressive modes serving opposed functions (mobilisation vs restoration). Mode-lock is pathological (chronic stress / vagal collapse). Transition is regulated, not gradual.
- **Confidence:** High — this is a textbook antagonistic pair with clear mutual suppression, mode-switching, and pathological mode-lock.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (autonomic physiology)

### Instance 3: Ecology — r-Selection vs K-Selection

- **Domain:** Ecology / Evolutionary Biology
- **Expression:** Populations oscillate between r-selected strategy (rapid reproduction, high offspring count, low parental investment, colonisation of disturbed habitat) and K-selected strategy (slow reproduction, few offspring, high investment, competition in stable habitat). At the population level these are antagonistic: resource allocation toward rapid reproduction suppresses investment in competitive fitness and vice versa. A population cannot maximally pursue both strategies simultaneously. The transition between modes is driven by environmental disturbance regime — but the population's response is a discrete strategic shift, not a linear interpolation. Pathology: a population locked in r-mode in a stable environment wastes resources; locked in K-mode when habitat is disturbed, it cannot recolonise. The modern framing (pace-of-life syndromes) preserves this antagonistic structure.
- **Structural alignment:** Two mutually suppressive life-history strategies. Each serves an opposed function (colonisation vs competition). Mode-lock in either direction is maladaptive. Transition is environmentally regulated.
- **Confidence:** Moderate-high — the structural match is strong, though the "mutual suppression" is mediated through resource allocation tradeoffs rather than direct neural/chemical inhibition. The antagonism is real but indirect.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (life-history theory, Pianka 1970, Reznick et al. 2002)

### Instance 4: Materials Science — Ductile vs Brittle Fracture Modes

- **Domain:** Materials Science / Solid Mechanics
- **Expression:** Crystalline materials fail through two antagonistic fracture modes: ductile (plastic deformation, energy absorption, slow crack propagation via dislocation motion) and brittle (cleavage fracture, minimal deformation, rapid catastrophic crack propagation). The two modes are mutually suppressive at the crack tip: dislocation emission blunts the crack and suppresses cleavage; cleavage propagation outruns dislocation nucleation and suppresses plastic flow. The ductile-brittle transition (DBT) is a genuine mode-switch governed by temperature, strain rate, and microstructure — not a smooth blend but a sharp transition with a well-defined transition temperature (DBTT). Pathology: materials locked in brittle mode fail catastrophically without warning (Liberty ships, Titanic steel); materials locked in ductile mode deform excessively under load. Engineering requires controlled placement relative to the transition.
- **Structural alignment:** Two mutually suppressive failure modes at the crack tip. Each serves an opposed mechanical function (energy absorption vs rapid separation). The transition is governed and sharp, not gradual. Mode-lock in either direction is problematic for engineering applications.
- **Confidence:** Moderate — the mutual suppression at the crack-tip mechanism level is genuine (Rice-Thomson model), but "health requires alternation" maps less directly. The structural parallel is in the mode-switch and mode-lock pathology rather than temporal oscillation.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (fracture mechanics, Rice & Thomson 1974)

## Assessment

| Instance | Domain | Structural Match | Alienness | Confidence | Verdict |
|----------|--------|-----------------|-----------|------------|---------|
| Sympathetic/Parasympathetic | Neuroscience | Strong — mutual suppression, regulated transition, mode-lock pathology | Medium (adjacent to existing neuro instance) | High | Accept — different system level (autonomic vs cortical networks) |
| r/K Selection | Ecology | Strong — antagonistic strategies, resource-mediated suppression, environmental mode-switch | High | Moderate-high | Accept — genuinely alien domain |
| Ductile/Brittle | Materials Science | Moderate — mutual suppression at crack tip, sharp transition, but "alternation" maps as spatial/parametric rather than temporal | Very high | Moderate | Accept with caveat — enriches the motif's scope beyond temporal oscillation |

**Recommendation:** All three instances strengthen the motif. The sympathetic/parasympathetic instance is the strongest structural match but least alien (still neuroscience). The r/K and ductile/brittle instances provide genuine domain distance. With 4 total instances across 3 domains (cognitive science, physiology, ecology, materials science), the motif would qualify for T1 candidacy pending triangulation.

**Domain count impact:** 1 → 4 instances, 1 → 3–4 domains (depending on whether physiology counts as distinct from cognitive science).

## OCP Records Created

- `ocp:sep/process-theism` — scraped during SEP dual-process search (tangential)
- `ocp:sep/process-philosophy` — scraped during SEP dual-process search (tangential)
- `ocp:sep/category-theory` — scraped during SEP dual-process search (tangential)

No directly relevant OCP records found or created for the identified instances. Future scrapes targeting autonomic physiology, life-history theory, or fracture mechanics would require domain-specific sources beyond current SEP/GitHub coverage.
