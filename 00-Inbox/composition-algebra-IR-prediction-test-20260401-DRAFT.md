---
status: DRAFT
date: 2026-04-01
type: empirical-test
source: Atlas test session, prompted by Adam
vault_safety: Read-only analysis of existing shard data. No pipeline modifications.
predecessors:
  - 00-Inbox/dir-composition-algebra-motif-prediction-20260401-DRAFT.md
  - 00-Inbox/dir-capstone-integrated-analysis-20260401-DRAFT.md
methodology: FTS5 and LIKE-based keyword search across 29 verified verb-record shards (~290K records), manual assessment of candidates against three-criteria filter
---

# I(R) Prediction Test — Empirical Results

**Date:** 1 April 2026
**Purpose:** Test the composition algebra's first genuine prediction: that I(R) — integration across recursive processes in different domains — should exist as a distinct motif in real-world text data.

---

## 1. Test Setup

### Data Available

- **30 shards** (shard-00 through shard-29), ~10,000 verb records each
- **29 verified shards** used (shard-01 through shard-29 in `/output/verified/`)
- **Total records searched:** ~289,420
- **Record stage:** ALL amorphous (no structured analysis beyond Tier A axis classification)
- **Axis distribution (per shard):** ~71% integrate, ~29% differentiate, ~0.4% recurse

### Source Domains

| Domain | Records/shard | Quality for I(R) Detection |
|--------|--------------|---------------------------|
| Pile-CC | ~3,150 | Low — web scraping, job posts, RSS feeds |
| PubMed Central | ~2,285 | High — academic papers with process descriptions |
| FreeLaw | ~2,015 | Low — legal text, not process-focused |
| Gutenberg | ~900 | Low — literature, not process-focused |
| ArXiv | ~500 | High — technical/scientific with explicit process descriptions |
| Wikipedia | ~290 | Moderate — encyclopedic, sometimes describes processes |
| PhilPapers | ~170 | Moderate — philosophical analysis of processes |
| Ubuntu IRC | ~130 | Very low — chat logs, noise |
| USPTO | ~120 | Moderate — patent backgrounds describe mechanisms |

### Search Method

Seven FTS5 queries run across 5 representative shards, then targeted LIKE queries with axis filtering and domain restriction. Manual assessment of ~60 text samples against three criteria:

1. **Cross-domain:** Does it describe integration ACROSS domains (not within)?
2. **Recursive/feedback:** Does it specifically involve recursive/feedback processes?
3. **Distinct from OFL/ISC:** Is it structurally distinct from R(R) and R(I)?

---

## 2. Search Results — Quantitative

### Broad FTS5 Queries (5-shard samples, extrapolated to 30)

| Query | Avg hits/shard | Est. total | Signal quality |
|-------|---------------|-----------|----------------|
| `transfer AND feedback` | 137 | ~4,110 | Very noisy — incidental co-occurrence |
| `analogous AND process` | 108 | ~3,240 | Noisy — bibliographic metadata |
| `mechanism AND domain` | 198 | ~5,940 | Noisy — job posts, legal text |
| `transfer AND learning AND domain` | 123 | ~3,690 | Moderate — some ML papers |
| `inspired AND biological` | 66 | ~1,980 | Moderate — some biomimicry |
| `borrow AND method` | 77 | ~2,310 | Noisy — varied contexts |
| `recursive AND interdisciplinary` | 5 | ~150 | Very few hits, higher precision |
| `feedback AND interdisciplinary` | 26 | ~780 | Moderate precision |

### Filtered Queries (all 29 verified shards)

| Filter | Total hits |
|--------|-----------|
| integrate-axis + recursion keywords + cross-domain keywords | 2,945 |
| Same, restricted to ArXiv + PubMed + PhilPapers + Wikipedia | ~400 (estimated) |
| Biomimicry / bio-inspired terms | ~25/shard × 29 = ~725 |
| Structural isomorphism / general systems theory | ~100/shard × 29 = ~2,900 |
| Tightest: explicit cross-domain feedback application | Results dominated by noise |

### Manual Assessment (60 samples inspected)

| Category | Count |
|----------|-------|
| Strong I(R) candidate (all 3 criteria) | 1 |
| Moderate I(R) candidate (2.5/3 criteria) | 2 |
| Weak I(R) candidate (2/3 criteria) | 1 |
| OFL/ISC in disguise (criterion 3 fails) | 1 |
| Cross-domain but not feedback-specific | ~5 |
| Noise (incidental keyword co-occurrence) | ~50 |

---

## 3. Candidate I(R) Instances

### Candidate A — STRONG: Memetic Science (shard-01, PhilPapers)

**Record ID:** `1322635c635e67a94b54d0c44a20f3ab56c3ae37572df13275b2189a15947441`
**Source:** Elan Moritz, "Memetic Science: I. General Introduction," *Journal of Ideas* 1(1), September 1990.

**Key passage:** "Memetic Science is the name of a new field that deals with the quantitative analysis of cultural transfer. The units of cultural transfer are entities called 'memes'. In a nutshell, memes are to cultural and mental constructs as genes are to biological organisms. [...] It is argued that the understanding of memes is of similar importance and consequence as the understanding of processes involving DNA and RNA in molecular biology. This paper presents a rigorous foundation for discussion of memes and approaches to quantifying relevant aspects of meme genesis, interaction, mutation, growth, death and spreading processes."

**I(R) Assessment:**
- **Criterion 1 (Cross-domain):** YES. Explicitly integrates biological replication/selection with cultural transmission — two fundamentally different domains.
- **Criterion 2 (Recursive/feedback):** YES. Both processes are recursive: gene replication → selection → adaptation → replication; meme copying → competition → mutation → copying. The paper explicitly describes "meme genesis, interaction, mutation, growth, death and spreading processes" — all recursive.
- **Criterion 3 (Distinct from OFL/ISC):** YES. This is not R(R) — neither system is observing itself. This is not R(I) — the paper isn't describing convergence to a fixed point. It's specifically recognizing that two independent recursive processes in different substrates (DNA vs. culture) share structural isomorphism, and integrating them into a unified framework. This is I(R): integration across recursive processes.

**Process-shape:** Recognizing structural isomorphism between biological evolution (recursive replication + selection in DNA) and cultural evolution (recursive copying + competition in ideas), producing a unified quantitative framework that applies to both.

**Confidence:** HIGH. This is textbook I(R).

### Candidate B — MODERATE: RL Curriculum / Transfer Learning (shard-01, ArXiv)

**Source:** Narvekar et al., "Curriculum Learning for Reinforcement Learning Domains: A Framework and Survey."

**Key passage:** "Transfer learning has been applied to reinforcement learning such that experience gained in one task can be leveraged when starting to learn the next, harder task."

**I(R) Assessment:**
- **Criterion 1:** PARTIAL. Cross-task, but within a single meta-discipline (ML). The "domains" are different RL environments (chess subgames, robotics tasks), not fundamentally different fields.
- **Criterion 2:** YES. RL feedback loops (reward → policy update → action → reward) are explicitly recursive.
- **Criterion 3:** YES. Not OFL or ISC.

**Verdict:** The I(R) structure is present (integrating recursive learning processes across task domains) but the domain-crossing is shallow. This may be I(R) at a lower derivative order — the pattern is there but the domains aren't maximally distinct.

### Candidate C — MODERATE: Ghana Decentralization Feedback (shard-25, PubMed Central)

**Source:** Health sector decentralization study, PubMed Central.

**Key passage:** "Self-reinforcing policy feedback mechanisms have given rise to similar tendencies towards centralized decision-making in the health sector, reversing early gains in the bottom-up development of the district health system."

**I(R) Assessment:**
- **Criterion 1:** YES. Governance processes and health sector processes are distinct domains.
- **Criterion 2:** YES. "Self-reinforcing policy feedback mechanisms" are explicitly recursive.
- **Criterion 3:** AMBIGUOUS. The feedback mechanisms in governance and health are nested (health operates within governance), not independent. This could be R(I) — recursive integration within a hierarchical system converging toward centralization — rather than I(R) — lateral integration across independent recursive systems.

**Verdict:** Borderline. The paper recognizes analogous feedback mechanisms across governance domains, but the nesting relationship muddies the I(R) vs R(I) distinction.

### Candidate D — WEAK: AstroPsychology / General Systems Theory (shard-10, Pile-CC)

**Source:** Glenn Perry, "What Is AstroPsychology?" position paper.

**Key passage:** "AstroPsychology [...] builds on this foundation by incorporating concepts from depth psychology, the perennial philosophy, and general systems theory. Jung's archetypal model is a central thread, but AstroPsychology borrows from other schools of thought, too."

**I(R) Assessment:**
- **Criterion 1:** YES. Cross-domain borrowing (astrology, psychology, philosophy, systems theory).
- **Criterion 2:** WEAK. The borrowing is of frameworks and models, not specifically of recursive/feedback processes. General systems theory does deal with feedback, but the passage describes framework integration, not feedback-loop integration.
- **Criterion 3:** YES. Not OFL or ISC.

**Verdict:** Integration across disciplines, but the integrated content is conceptual frameworks, not specifically recursive processes. More I(D) (integrate across distinctions) than I(R).

### Non-Candidate: Indirect Reciprocity (shard-01, ArXiv)

**Source:** Nakamura & Dieckmann, "Voting by Hands Promotes Institutionalised Monitoring in Indirect Reciprocity."

**Reason for rejection:** Co-evolutionary feedback between game-players and monitors is within a single domain (evolutionary game theory). The recursion is self-referential (monitors monitoring the monitoring process). This is R(R)/OFL, not I(R).

---

## 4. Assessment

### Verdict: INCONCLUSIVE, TRENDING POSITIVE

**The algebra's I(R) prediction is not confirmed but is not falsified.** One strong candidate was found. The data quality severely limits the test's power.

### What the data shows:

1. **One clean I(R) instance exists** (Memetic Science). This paper performs exactly the operation I(R) predicts: recognizing structural isomorphism between recursive processes in biology and culture, and integrating them into a unified framework. The match is precise, not forced.

2. **Two moderate candidates** show the I(R) pattern with partial domain-crossing or ambiguous OFL/ISC boundary.

3. **The signal-to-noise ratio is catastrophic** for keyword search on amorphous records. ~50/60 inspected samples were noise. The test method is blunt: we're looking for a subtle structural pattern using word co-occurrence in unprocessed text.

### What the data does NOT show:

1. Whether I(R) is a common or rare pattern in the wild. One instance in 290K records could mean it's rare, or it could mean our search terms are poorly calibrated for the data.

2. Whether I(R) is genuinely distinct from adjacent compositions, or whether the boundary between I(R), R(I), and OFL is fuzzy in practice (as the capstone analysis warned).

3. Whether the Memetic Science instance is coincidental or representative.

### Confounds and limitations:

| Limitation | Impact |
|-----------|--------|
| All records amorphous (no structured analysis) | Severe — can't filter by process-shape or derivative order |
| Keyword search on raw text | Severe — can't distinguish semantic I(R) from incidental word co-occurrence |
| Source distribution skewed toward low-process-density domains (IRC, web, legal) | Moderate — academic sources are only ~30% of records |
| No motif assignment completed | Severe — can't check what's already been classified as ISC or OFL |
| Sample inspection limited to ~60 records | Moderate — may have missed candidates in uninspected results |

### Interpretation hierarchy:

**Most likely:** I(R) exists as a real pattern in text, but occurs in academic/technical writing about cross-disciplinary methodology transfer. The current shard data has limited coverage of this material type, and the search method is too blunt to detect it reliably. The single strong candidate (Memetic Science) is real but the test is underpowered.

**Less likely:** The search terms are broad enough to find superficial matches for anything, and the "Memetic Science" candidate is post-hoc pattern-matching on my part. Against this interpretation: the assessment criteria were defined before the search, and the candidate passes all three cleanly.

**Least likely:** I(R) doesn't exist as a distinct pattern. Against this interpretation: the Memetic Science paper does exactly what I(R) predicts — you can point at the specific move (integrating biological and cultural recursion) and it is structurally distinct from the closest known motifs.

---

## 5. Recommendations

### To strengthen this test:

1. **Create an I(R) indicator set** for the governance plugin. Suggested indicators:
   - `cross_domain_feedback_transfer`: "Feedback mechanism from domain X applied to domain Y"
   - `recursive_process_isomorphism`: "Same recursive structure identified in different substrates"
   - `biomimetic_feedback`: "Biological feedback process inspiring engineering design"
   - `methodological_recursion_transfer`: "Iterative method from one field applied to another"
   - `unified_recursive_framework`: "Framework unifying recursive processes across domains"

2. **Re-process ArXiv and PubMed subsets** with I(R) indicators active. These domains are most likely to contain the pattern.

3. **Promote the Memetic Science record** to "structured" stage with I(R) motif assignment for calibration.

4. **Run a focused Tier C evaluation** on the 2,945 filtered candidates (integrate-axis + recursion + cross-domain keywords) to separate genuine process descriptions from noise.

### For the composition algebra:

- The I(R) prediction is **not falsified.** One clean instance + two moderate instances from a blunt search of noisy data is a positive signal, but insufficient for confirmation.
- The boundary between I(R) and R(I) is empirically fuzzy (Ghana paper). This is interesting in itself — it may indicate that the commutativity failure between I and R is real but the boundary is gradient rather than sharp.
- The next test should be done with properly structured records and semantic search, not keyword matching on raw text.

---

## Appendix: Search Queries Run

### FTS5 Queries (on verb_records_fts)
```sql
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'transfer AND feedback';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'analogous AND process';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'inspired AND biological';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'borrow AND method';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'transfer AND learning AND domain';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'mechanism AND domain';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'recursive AND interdisciplinary';
SELECT * FROM verb_records_fts WHERE verb_records_fts MATCH 'feedback AND interdisciplinary';
```

### Targeted LIKE Queries
```sql
-- Cross-domain feedback transfer (tight)
WHERE process_axis = 'integrate'
AND (source_raw_text LIKE '%feedback mechanism%from%to%'
  OR source_raw_text LIKE '%recursive process%applied to%'
  OR source_raw_text LIKE '%feedback loop%analogous%'
  OR source_raw_text LIKE '%biological feedback%engineer%'
  OR source_raw_text LIKE '%biomimetic%feedback%'
  OR source_raw_text LIKE '%isomorphism%between%process%')

-- Academic cross-domain transfer + feedback
WHERE domain IN ('ArXiv', 'PubMed Central')
AND (source_raw_text LIKE '%transfer learning%'
  OR source_raw_text LIKE '%domain adaptation%'
  OR source_raw_text LIKE '%cross-domain%')
AND (source_raw_text LIKE '%feedback%'
  OR source_raw_text LIKE '%recursive%'
  OR source_raw_text LIKE '%iterative%')

-- Systems theory / structural isomorphism
WHERE source_raw_text LIKE '%general systems%theory%'
  OR source_raw_text LIKE '%structural isomorphism%'
  OR source_raw_text LIKE '%universal%pattern%' AND source_raw_text LIKE '%feedback%'
```

### Shards Queried
- Full queries: all 29 verified shards (shard-01 through shard-29)
- Sample inspection: 6 representative shards (01, 05, 10, 15, 20, 25)
- Full text extraction: 5 individual records
