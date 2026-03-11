---
date: 2026-03-11
source: opencode/gpt-5.4
method: adversarial non-derivability test
status: draft
target: Reachability-Space Rewriting
name: "RSR Adversarial Test"
tier: 0
confidence: 0.3
derivative_order: 2
primary_axis: recurse
---

# RSR Adversarial Test

## Question

Can `Reachability-Space Rewriting` appear as the primary structural invariant in domains where `Reflexive Structural Transition` is absent, weak, or clearly not the right explanation?

- If yes, RSR may have independent Tier 2 standing.
- If no, RSR is more likely an effect signature, annotation, or meta-descriptor.

## Evidence Base

### Prior Motif Context

- Candidate under test: `02-Knowledge/motifs/algebra-prediction-recurse-t2-20260311.md`
- Primary derivation risk: `02-Knowledge/motifs/reflexive-structural-transition.md`
- Library state reference: `02-Knowledge/motifs/MOTIF_INDEX.md`
- Algebra stabilisation conditions: `02-Knowledge/architecture/axiomatic-motif-algebra-v02-spec-20260311.md`

### Domain Selection Notes

- Direct OCP scrape attempts on `cartography`, `cryptography`, and `urban-planning` topics were mostly timeout-prone or sparse.
- `urban planning / zoning` in particular had poor direct fit in the current OCP corpus: direct `zoning` scrape produced only 2 indexed records plus noise.
- I therefore substituted a better-indexed adjacent adversarial domain: `policy-as-code / admission control / rule-imposed possibility spaces`.
- This preserves the criterion of the test: an external or structural layer rewrites what futures are allowed while reflexive self-triggering is weak or absent.

### Adversarial Domain A - Cartography / Geospatial Representation

- Relevant OCP corpus size: 8+ scraper-derived records already indexed in the repo.
- Representative records inspected:
  - `ocp:github/maplibre--maputnik`
  - `ocp:github/protomaps--basemaps`
  - `ocp:github/mapnik--mapnik`
- Additional relevant indexed records identified in corpus:
  - `ocp:github/geopandas--contextily`
  - `ocp:github/protomaps--protomaps-leaflet`
  - `ocp:github/mbloch--mapshaper`
  - `ocp:github/geoswift--geoswift`
  - `ocp:github/sshuair--awesome-gis`
  - `ocp:github/aourednik--historical-basemaps`
  - `ocp:github/3dstreet--3dstreet`

### Adversarial Domain B - Cryptography / Key Management / Secrets Management

- Relevant OCP corpus size: 8+ scraper-derived records already indexed in the repo.
- Representative records inspected:
  - `ocp:github/cosmian--kms`
  - `ocp:github/starekrow--lockbox`
  - `ocp:github/pulumi--esc`
- Additional relevant indexed records identified in corpus:
  - `ocp:github/jedisct1--libsodium`
  - `ocp:github/cryptomator--cryptomator`
  - `ocp:github/tongsuo-project--rustyvault`
  - `ocp:github/caddyserver--caddy`
  - `ocp:github/decentralized-identity--veramo`
  - `ocp:github/gchq--cyberchef`
  - `ocp:github/ente-io--ente`

### Adversarial Domain C - Policy-as-Code / Admission Control

- Substituted for the originally suggested `urban planning / zoning` domain due sparse direct scrape fit.
- Relevant OCP corpus size: 8+ scraper-derived records already indexed in the repo.
- Representative records inspected:
  - `ocp:github/open-policy-agent--opa`
  - `ocp:github/aws-cloudformation--cloudformation-guard`
  - `ocp:github/elithrar--admission-control`
- Additional relevant indexed records identified in corpus:
  - `ocp:github/open-policy-agent--awesome-opa`
  - `ocp:github/tmobile--pacbot`
  - `ocp:github/anderseknert--kube-review`
  - `ocp:github/permitio--opal`
  - `ocp:github/kptdev--kpt`
  - `ocp:github/tmobile--magtape`
  - `ocp:github/safedep--vet`

## Domain Analysis

### Cartography / Geospatial Representation

#### Observations

- Projection, tiling, format conversion, and style-spec editing all rewrite what spatial relationships are representable or renderable without requiring the map system to self-dissolve.
- The same geographic substrate can be re-expressed across GeoJSON, WKT/WKB, vector tiles, basemap styles, temporal layers, and 2D/3D views; the reachable representation set changes while the substrate remains.
- Legacy/new-runtime coexistence is a strong signal: `protomaps-leaflet` explicitly bridges older Leaflet systems while recommending `MapLibre GL` for new work.
- Human-authored or pipeline-authored choice dominates; the rewrite is usually imposed by designers, analysts, or standards layers rather than reflexive self-triggering.

#### Adversarial Questions

- `Is RSR the primary invariant here, or is RST a better explanation?`
  - `RSR` is the better invariant here. `RST` is weak.
- `Is RSR merely the state-space view of RST?`
  - No. They separate cleanly. Reachability rewrite is strong; reflexive trigger is mostly absent.
- `Is RSR a consequence class shared by other motifs?`
  - Yes, strongly. In cartography it often looks downstream of standardization, format transduction, layered abstraction, and compatibility bridging.
- `Can RSR predict anything on its own?`
  - Yes, but modestly: any domain with stable substrate plus many interoperable views should develop adapter layers, interchange standards, and migration bridges even without reflexive transition.

### Cryptography / Key Management / Secrets Management

#### Observations

- Moving keys behind HSM/KMS layers, brokered secret access, client-side encryption, or safe-default APIs rewrites which operations are reachable, by whom, and through which interfaces.
- The dominant move is capability-graph rewrite: fewer dangerous states are reachable, more secure flows become default, and trust/authority migrate to other layers.
- `libsodium`, `lockbox`, `cryptomator`, `Cosmian KMS`, and `Pulumi ESC` all alter future decryptability, signing authority, or secret accessibility without needing system self-dissolution.
- Certificate automation and secret orchestration show border cases where some trigger-driven maintenance exists, but the main explanatory pattern remains reachability control, not reflexive structural transition.

#### Adversarial Questions

- `Is RSR the primary invariant here, or is RST a better explanation?`
  - `RSR` is primary. `RST` is weak and mostly peripheral.
- `Is RSR merely the state-space view of RST?`
  - No. Clean separation is possible here. Safe-default API hardening and authority relocation rewrite reachable actions without reflexive trigger.
- `Is RSR a consequence class shared by other motifs?`
  - Partly, yes. It overlaps with abstraction hardening, trust-boundary relocation, and broker/proxy mediation. But in crypto, key location and access mediation are so central that RSR behaves more like a real operator than in cartography.
- `Can RSR predict anything on its own?`
  - Yes: in a fourth domain it predicts authority relocation, narrowing of unsafe defaults, mediated privileged operations, and durable branch closure of unsafe futures even with little reflexive restructuring.

### Policy-as-Code / Admission Control

#### Observations

- This domain rewrites futures at boundaries: CI, IaC validation, policy engines, and admission webhooks prune or mutate possible states before they exist in runtime.
- Mutation and denial are two forms of the same structural action: both alter reachability, one by forbidding states, the other by rewriting objects into allowed states.
- `OPA`, `CloudFormation Guard`, and `admission-control` are strong examples of externalized rule layers changing what can happen without the governed object initiating its own transformation.
- This is the cleanest adversarial case of strong reachability rewrite with weak reflexive self-triggering.

#### Adversarial Questions

- `Is RSR the primary invariant here, or is RST a better explanation?`
  - `RSR` is primary. `RST` is clearly weaker.
- `Is RSR merely the state-space view of RST?`
  - No. Static policy checks and admission denials show strong reachability rewrite with almost no reflexive trigger.
- `Is RSR a consequence class shared by other motifs?`
  - Yes, partly. The mechanism is often governance, gatekeeping, and boundary enforcement. In this domain, `Dual-Speed Governance` is a strong competing explanation for the architecture, while RSR names the downstream effect.
- `Can RSR predict anything on its own?`
  - It predicts hot-reload/distribution of rules, dry-run tooling, deny-vs-mutate bifurcation, shift-left validation, and increasing importance of explanation/testing at enforcement boundaries.

## Comparison Against Existing Motifs

### RSR vs RST

- `RST` requires a system containing the program for its own controlled dissolution and recomposition, with reflexive thresholding strong in the canonical cases.
- The adversarial domains repeatedly show reachability rewrite without that reflexive dissolution program.
- This means `RSR` is broader than `RST` and cannot be reduced to `RST` alone.

### RSR vs Dual-Speed Governance

- `Dual-Speed Governance` often explains who changes the constraint frame and at what speed.
- In policy-as-code and some cryptographic governance cases, this is sharper than `RSR` as an architectural explanation.
- `RSR` often describes what the governance change causes, not the mechanism that causes it.

### RSR vs Explicit State Machine Backbone

- `Explicit State Machine Backbone` governs motion on a fixed transition graph.
- `RSR` names graph rewrite: which transitions remain admissible at all.
- This is a real distinction, but many adversarial cases still cash out as governance and gating over explicit states rather than a freestanding recurse operator.

### RSR vs Alignment by Compression

- This is the most dangerous overlap.
- In cartography and policy/schema systems, many reachability rewrites are produced by alignment/compression into shared standards or approved representations.
- That makes `RSR` look like a consequence class more often than an independent operator.

## Verdict

### Reclassify

`Reachability-Space Rewriting` is real, but this adversarial test does not support it as an independent Tier 2 operator yet.

## Rationale

### c — Cross-domain validation

- Pass.
- The candidate clearly appears across adversarial domains where `RST` is weak or absent.
- That means RSR is not merely a restatement of RST.

### i — Structural invariance

- Moderate pass.
- The same shape survives across cartography, crypto, and policy domains: an external or structural layer changes which futures remain admissible.

### d — Non-derivability

- Fail for Tier 2, at present.
- Under adversarial pressure, RSR usually appears as a second-order description of what other motifs are doing.
- In cartography it is often downstream of interoperability and representation-layer motifs.
- In policy-as-code it is often the effect of governance, chokepoints, and explicit enforcement boundaries.
- In crypto it comes closest to operator status, but still overlaps heavily with authority relocation, safe-default narrowing, and lifecycle control.

## What RSR Predicts On Its Own

- RSR's strongest independent prediction is: look for moments where a system is not merely moving through a possibility space, but altering which future moves remain possible at all.
- This predicts:
  - branch closure and branch opening
  - strong path dependence
  - non-commutativity of history
  - emergence of adapters, mediators, or rule-boundary layers

But that predictive content is still too often derivable from `Dual-Speed Governance + Alignment by Compression + explicit gating/state structure`.

## Final Judgment

- `Promote` — no
- `Hold` — no
- `Reclassify` — yes
- `Kill` — no

The cleanest read is that `RSR` is better understood, for now, as an effect signature or meta-descriptor: a useful way to annotate what several other motifs do to the future-set of a system, but not yet a standalone Tier 2 recurse-axis operator.

## Recommendation

- Do not recommend Tier 2 promotion for `RSR` at this time.
- Reuse it as an annotation lens for other motifs: when a motif changes the admissible future-set, tag that effect explicitly.
- If `RSR` is to survive as a future operator, it needs a domain where:
  - reachability rewrite is primary,
  - reflexive trigger is weak or absent,
  - and neither governance nor alignment/compression explains the case more sharply.
