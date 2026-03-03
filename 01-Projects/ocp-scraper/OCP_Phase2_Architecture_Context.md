# OCP Scraper — Phase 2+ Architecture Context

**Source:** Creative Methodology Test (OscillateAndGenerate → ConvergeAndEvaluate pipeline)
**Date:** 3 March 2026
**Phase 1 Status:** Complete (34/34 ISC, all 5 CLI commands working)

---

## The Three Load-Bearing Innovations (from architecture design)

### 1. Problem Template Engine
Instead of LLM classifying each repo individually, use TEMPLATES — a finite set of problem categories with pattern-matching rules that assign repos to categories based on topics, dependencies, README structure. The template set grows over time. LLM is used to GENERATE templates in batch, not to classify individual repos.

**How it works:**
- Templates define problem categories (e.g., "caching", "authentication", "state management")
- Each template has pattern-matching rules: topic patterns, dependency signatures, README structure indicators
- Repos are classified deterministically by matching against templates — no LLM call per repo
- LLM involvement is batch: take 50-100 high-signal repo metadata bundles → generate/refine templates
- Templates are versioned, proposed by AI, approved by human ("AI articulates, humans decide")
- Template set is itself a publishable artifact — a machine-readable ontology of solved software problems

**Why it matters:** Solves the energy efficiency constraint. LLM cost amortized across all repos matching a template. System can classify repos WITHOUT any LLM at all using templates — LLM just improves template quality over time.

### 2. Graph Index (partially in Phase 1)
Solutions as nodes, compositions as edges. Phase 1 has the SQLite edge table from dependency graphs. Phase 2 enriches this with:
- Shared problem domain edges (repos solving related problems)
- Compatible port edges (repos with complementary composability interfaces)
- Cross-domain structural isomorphism edges (e.g., software caching solution structurally similar to warehouse buffering solution)

**Search becomes graph navigation:** User describes problem → system finds nearest node(s) → shows immediate neighbourhood (related solutions, alternative approaches, composition pathways) → user navigates by clicking through connections.

### 3. Search-as-Validation
The query and validation mechanisms are the same interface. When a user searches and finds a solution:
- "Did this solve your problem? Yes/No" — one-click atomic trust operation
- Independent validations accumulate into the 6-dimension trust vector
- The search experience IS the validation mechanism
- No separate curation step needed — curation happens through use

**2028 vision:** Instead of "type a problem, see solutions," it's "describe your project context, see how your architecture composes from known solved problems, with trust indicators for each component."

---

## Phase 2+ Feature Designs

### Negative Space Analysis (deferred from Phase 1 to v1.1)
Index what DOESN'T exist, not just what does. If a query matches components but not the intersection, the system knows where unsolved problems are.

**Uses:**
- Shows users where the hard, unsolved problems are
- Guides template evolution (gaps worth filling)
- Could become a "bounty" system — "these problems need solutions"
- Creates "ideal state gap" experience — shows distance between what you need and what's been solved
- Inherently resistant to gaming — you can't game what doesn't exist

**Implementation:** Track zero-match queries. Cluster them. Identify where template coverage has gaps. Display gaps as visible features in the problem-space map.

### Query Feedback Loop
Zero-match queries are logged. Periodic batch LLM analysis identifies clusters of unmatched queries → proposes new templates. Template changes = ontology changes = governance events (human approval required).

**Coverage Dashboard:** Shows which problem categories have good template coverage, which have gaps, which repos remain unclassified.

### Template Governance
Problem templates are versioned, proposed by AI, approved by human. This mirrors OCP's "AI articulates, humans decide" principle. Template changes are ontology changes — they need governance.

### Dual-Speed Feedback Cycle
- **Fast loop:** Deterministic query → indexed results (<1s)
- **Slow loop:** Query patterns → gap analysis → new template proposals → human-approved ontology changes (hours/days)

The system has three temporal layers:
1. Batch scraping (periodic, scheduled)
2. Real-time queries (on-demand)
3. Template evolution (slow, governed)

### Federation (JSON Feed)
Phase 1 is single vault. Federation = publishing vault contents as JSON Feed. Push to Codeberg → instant federation. When two vaults federate, they're merging graph regions. Overlap points (shared solution records) become natural trust anchors.

### Ecosyste.ms Data Consumption
Libraries.io and Ecosyste.ms already index package ecosystems with open data. The scraper could consume their datasets as more efficient alternative to hitting GitHub API directly for bulk metadata. GitHub API for README and specific repo details; Ecosyste.ms for bulk package metadata.

---

## Recommended Phase 2 Sequencing

Based on the architecture evaluation (C&E verdict), here's the recommended build order:

### Phase 2a — Template System (highest value, unlocks everything else)
1. **Problem Template format** — define the JSON schema for templates (pattern rules, category metadata, version info)
2. **Template matching engine** — given a repo's metadata, find the best-matching template
3. **Batch template generation** — LLM takes N repo metadata bundles → generates template proposals
4. **Template governance** — CLI commands: `ocp template list`, `ocp template propose`, `ocp template approve`
5. **Re-classification** — re-run template matching on existing records when new templates are approved

### Phase 2b — Search Enhancement
1. **Negative space analysis** — track zero-match queries, display gaps
2. **Search-as-validation** — add "Did this solve your problem?" to search results, record validation events
3. **Graph enrichment** — add shared-domain and compatible-port edges beyond dependency-only edges
4. **Problem decomposition search** — LLM-assisted query decomposition for complex problems

### Phase 2c — Feedback & Evolution
1. **Query feedback loop** — log queries, batch-analyse gaps, propose new templates
2. **Coverage dashboard** — `ocp coverage` showing template coverage stats
3. **Dual-speed cycle** — wire fast search loop to slow template evolution loop

### Phase 3 — Federation
1. **JSON Feed generation** — `ocp publish` generates feed from vault
2. **Feed consumption** — `ocp subscribe <feed-url>` imports records from other vaults
3. **Trust merging** — how to handle trust vectors from federated records
4. **Forge adapters** — Codeberg and Forgejo implementations

---

## Key Constraints Carrying Forward

- **NO per-repo LLM calls** in default pipeline (templates handle classification)
- **AI proposes, human approves** for all template/ontology changes
- **Energy efficiency** — batch LLM only, amortized across templates
- **Operational simplicity** — CLI tool, git-backed, one-person operable
- **Sovereignty** — everything local, federation opt-in
- **Forge-agnostic** — adapter interface, never GitHub-locked

---

## Architecture Confidence Notes (from Evaluative Interrogation)

**Fractal potential confirmed:** The template/graph/validation pattern works beyond software. Templates define problem categories in any domain. Graph spans domains. Validation is universal. Tested against mining/surveying domain — generates genuine structure.

**Weight confirmed:** Every core component is necessary, not decorative. Remove templates → need per-repo LLM (violates energy). Remove graph → lose cross-domain. Remove dual-speed → static system. Only negative space is "clever but dispensable for v1."

**Simplicity test passed:** "Scrape GitHub repos. Classify them into problem categories using templates. Index them as a graph. Let people search by problem and validate what works."

---

*"AI articulates, humans decide."*
