---
status: candidate
date: 2026-03-23
target_motif: Prediction-Error as Primary Signal
batch: 6
run: 1
---
# Batch 6 Run 1 — Prediction-Error as Primary Signal Expansion

## Target

The motif currently sits at T0 with two documented instances (Cognitive Science/Predictive Coding, Music Theory/Cadential Expectation). A prior candidate (extended-B-run-6) proposed three additional instances in Control Theory, Financial Economics, and Communication Engineering. This run seeks genuinely alien domains — structurally distant from all five prior domains — to further strengthen the motif's cross-domain validity.

Domain-independent formulation: *A system that generates expectations transmits only the delta between prediction and reality, making surprise — not confirmation — the primary information carrier.*

## Method

- OCP search: `predictive coding error-driven learning` (returned large result set; top hits confirmed existing coverage)
- OCP search: `model predictive control feedback` (returned large result set; confirmed control-theory domain already covered)
- OCP scrape: `sep` source, topic `prediction error` (returned: Prediction vs Accommodation, Delusion, Philosophy of Statistics, Connectionism, Problem of Induction — SEP articles indexed)
- Domain knowledge applied for alien domain identification in immunology, geology, and developmental biology

## Discovered Instances

### Domain: Immunology — Thymic Selection and Immune Surveillance

- **Mechanism**: The adaptive immune system maintains a forward model of "self" — the repertoire of self-antigens presented during thymic selection. T-cells that react to self-peptides are eliminated (negative selection), leaving only T-cells that respond to non-self. In peripheral immune surveillance, antigen-presenting cells display peptides to T-cells. If the presented peptide matches the self-model (prediction confirmed), no response occurs. Only peptides that deviate from the self-model — the immunological prediction error — trigger an immune response. The system is architecturally silent when predictions hold and active only on mismatch.
- **Prediction-error role**: The immune response is driven entirely by the delta between the self-model (established during development) and the observed antigen. Self-antigens (predicted signals) are actively suppressed via tolerance mechanisms. Foreign antigens (prediction errors) are the only signals that propagate through the activation cascade. Autoimmune disease represents a failure mode where the self-model is corrupted, causing false prediction errors — structurally equivalent to a miscalibrated Kalman filter generating spurious innovations.
- **Structural validity**: genuine
- **Source**: Domain knowledge; structural alignment with Matzinger's Danger Model (1994) which further refines toward damage-signal-as-error. SEP connectionism article (ocp:sep/connectionism) discusses pattern-matching architectures relevant to recognition systems.

### Domain: Seismology — Coulomb Stress Transfer and Earthquake Triggering

- **Mechanism**: The Earth's crust maintains a stress field that evolves according to tectonic loading models. Seismologists construct forward models of expected stress accumulation on fault segments (Coulomb stress models). An earthquake occurs when the actual stress state deviates from the frictional strength threshold — but the triggering of subsequent earthquakes is governed by the *change* in Coulomb stress caused by the first event (the Coulomb stress transfer, or delta-CFS). A fault segment that was already at its predicted stress level receives no net perturbation from a distant earthquake. Only segments where the stress transfer creates a mismatch between expected and actual proximity-to-failure are driven toward (or away from) rupture.
- **Prediction-error role**: The delta-CFS — the difference between the stress state predicted by the background loading model and the stress state after perturbation by a nearby earthquake — is what determines whether a fault is promoted or inhibited. The absolute stress level is less informative than the unexpected change. Aftershock sequences cluster precisely in regions of positive delta-CFS (positive prediction error). The system signals on deviation from the expected stress trajectory, not on absolute stress magnitude.
- **Structural validity**: genuine (with qualification — the "forward model" is constructed by seismologists, not by the crust itself; however, the physical dynamics genuinely operate on stress deltas rather than absolute stress, making this a case where nature implements the pattern even without an agent constructing the model)
- **Source**: King, Stein, and Lin (1994), "Static stress changes and the triggering of earthquakes," *Bulletin of the Seismological Society of America*. SEP prediction-accommodation article (ocp:sep/prediction-accommodation) discusses the epistemic status of prediction in physical sciences.

### Domain: Cellular Biology — Unfolded Protein Response (UPR)

- **Mechanism**: The endoplasmic reticulum (ER) maintains a forward model of protein-folding capacity — a homeostatic set-point for the ratio of chaperone proteins to unfolded protein substrates. Under normal conditions, the sensor protein BiP binds to and silences three transmembrane stress sensors (IRE1, PERK, ATF6). When misfolded proteins accumulate beyond the predicted capacity, BiP is titrated away from the sensors to act as a chaperone, releasing the sensors to activate. The signal that propagates is not "proteins are being folded" (confirmation) but "there are more misfolded proteins than expected" (prediction error). The magnitude of UPR activation is proportional to the mismatch between folding capacity and folding demand.
- **Prediction-error role**: The ER's "prediction" is its calibrated chaperone capacity. The "observation" is the actual load of unfolded proteins. Only the delta — excess unfolded proteins beyond chaperone capacity — triggers the response cascade. When prediction matches reality (chaperone capacity meets demand), the sensors remain silenced. The system coasts on its model. When the error is sustained and uncorrectable, the system triggers apoptosis — a catastrophic failure mode analogous to filter divergence in control theory.
- **Structural validity**: genuine
- **Source**: Walter and Ron (2011), "The Unfolded Protein Response: From Stress Pathway to Homeostatic Regulation," *Science*. The BiP-titration mechanism provides a molecular-level implementation of prediction-error gating.

## Assessment

- Domains before: 5 (with extended-B-run-6 candidates) -> Domains after: 8
- Confidence recommendation: 0.5 (base 0.1 + 0.1 per additional alien domain beyond the first two, capped conservatively given that extended-B-run-6 candidates are not yet promoted)
- Tier recommendation: T1 (already justified by extended-B-run-6); these three instances strengthen the case for T2 candidacy
- Key insight: The motif appears in systems with no plausible causal or historical connection — from engineered codecs to immune systems to tectonic stress transfer to ER protein folding. The recurring structural shape is: a system maintains a baseline expectation, and only deviations from that baseline propagate as actionable signal. The immunology and UPR instances are particularly compelling because they are molecular-level implementations in biology, yet structurally isomorphic to the Kalman filter's innovation sequence. The seismology instance is the most alien — the "forward model" is implicit in the physics of stress accumulation rather than constructed by an agent — which tests whether the motif requires an intentional modeller or merely the structural pattern of delta-driven dynamics.

## OCP Records Created

- ocp:sep/prediction-accommodation (scraped this session)
- ocp:sep/delusion (scraped this session)
- ocp:sep/statistics (scraped this session)
- ocp:sep/connectionism (scraped this session)
- ocp:sep/induction-problem (scraped this session)
