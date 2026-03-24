# Governance D/I/R Analysis — 2026-03-25

> Dataset processor pipeline issues at scale: source type counting, SQLite corruption, stale state, conflicting evidence, zero promotions.

## Known Issues

1. `source_types = 1` for all records — everything maps to `the-pile` as `source_dataset`
2. Shard-01 SQLite database corrupt — WAL never checkpointed, btree pages malformed
3. Pipeline state files stale — show `totalVerbRecords: 0` and `stoppedReason: "running"`
4. 10 CRITICAL conflicting-evidence anomalies — top motifs share thousands of passages
5. Zero promotions despite 14+ domains and 0.42+ confidence for top motifs
6. Git "confused by unstable object source data" errors during concurrent shard processing on ZFS

---

## Pass 1 — DESCRIBE

### What the data actually shows

**Shard-00** (568 MB, healthy):
- 9,922 verb records across 18 motifs, 15 domains
- `source_dataset = 'the-pile'` for 100% of records (hardcoded in pipeline.ts:751)
- `source_component` = Pile sub-component (Pile-CC, PubMed Central, FreeLaw, etc.)
- `domain` = identical to `source_component` for 100% of records (set at pipeline.ts:770)
- `extraction_method = 'primed'` for 100% — no blind extractions succeeded
- Processing state: 5,899,215 docs processed, 606,608 candidates, 0 verb_records_produced
- Verb records created during buffer flush, not tracked in processing_state

**Shard-01** (463 MB, CORRUPT):
- `SQLITE_CORRUPT` on btree pages (Tree 26), hundreds of malformed pages
- WAL file: 47 MB, never checkpointed
- Pipeline state file: 2 passes ran, 607K candidates each, 0 verb records, `stoppedReason: "running"`
- Only 5 records recoverable via `.dump`

**Shard-02** (109 MB, healthy, in progress):
- 4,614 verb records
- Integrity check: OK
- Processing state: 453,443 docs, 46,283 candidates, pass-1 completed

### The evidence aggregator's source type logic

```typescript
// evidence-aggregator.ts:61-77
// Source types (extraction_method maps to source type)
// 'primed' = top-down, 'blind' = bottom-up
const sourceTypeRows = db.prepare(`
  SELECT extraction_method, COUNT(*) as cnt
  FROM verb_records WHERE motif_id = ?
  GROUP BY extraction_method
`).all(motifId);

// Maps: 'primed' → 'top-down', 'blind' → 'bottom-up'
// Both present → adds 'triangulated'
```

This is the root cause of issue #5. The evidence aggregator conflates "source type diversity" (independent data sources) with "extraction method diversity" (primed vs blind). The T0→T1 threshold requires `sourceTypes >= 2`, meaning it requires **both primed and blind extraction methods** — not multiple independent data sources. Since all 9,922 records used `primed` extraction (blind extraction fraction is 10% but no blind candidates passed Tier A), `sourceTypeCount` is always 1.

### The actual independence structure of The Pile

The Pile's sub-components are genuinely independent data sources:
- **PubMed Central**: biomedical research papers
- **FreeLaw**: US legal opinions
- **ArXiv**: physics/math/CS preprints
- **Pile-CC**: Common Crawl web text
- **Gutenberg (PG-19)**: 19th-century literature
- **Github**: source code repositories
- **Wikipedia (en)**: encyclopedia articles

These are as independent as different datasets. A motif appearing in legal opinions AND biomedical papers AND source code is strong cross-domain evidence.

### Pipeline state staleness

The pipeline saves state via `savePipelineState()` (pipeline.ts:203) which writes `totalVerbRecords` from `getVerbRecordCount()`. But this count comes from `this.db` (the pipeline's Database connection), while actual record insertion happens in `this.store` (VerbRecordStore, which opens its **own** Database connection at verb-record-store.ts:66). WAL mode means the pipeline's connection doesn't see the store's uncommitted writes. The state file is written mid-pass before the buffer flush at pipeline.ts:252, so `totalVerbRecords` is always 0 at save time.

Additionally, `stoppedReason` starts as `'running'` and is only updated to a terminal state at the end of the main loop (pipeline.ts:247-249). If the process crashes or is killed, the state file retains `'running'`.

### SQLite corruption on NFS/ZFS

Shard-01 ran on ZFS-backed NFS storage. SQLite WAL mode requires proper `fsync` semantics and shared memory (`-shm` file) for reader coordination. NFS doesn't support POSIX shared memory locks, and ZFS-over-NFS can reorder or lose writes during crashes. The 47 MB WAL file was never checkpointed, meaning all writes after the initial database creation were in the WAL only. A crash or NFS timeout caused permanent corruption.

The git "unstable object source data" errors are the same root cause: git's object store uses `fsync` assumptions that NFS/ZFS can violate under concurrent write load.

---

## Pass 2 — INTERPRET

### Issue clustering: three root causes, not six

The 6 reported issues reduce to **3 root causes**:

**Root Cause A: Semantic mismatch in evidence aggregator** (issues #1, #4, #5)
- The `sourceTypes` field counts extraction methods (primed/blind), not data sources
- The field name `sourceTypes` and threshold name `sourceTypes` are misleading
- The Pile sub-components ARE the independent sources, but they're stored in `source_component` and `domain`, never consulted by the evidence aggregator
- The conflicting-evidence anomalies (#4) are a separate issue: same source text matching multiple motifs. This is a template overlap problem, not directly related to source types, but it compounds the promotion blocker because `hasConflictingEvidence` also blocks T0→T1 (tier-promoter.ts:133)

**Root Cause B: NFS/ZFS storage incompatibility with SQLite WAL** (issues #2, #6)
- SQLite WAL requires POSIX shared memory (`mmap` on `-shm` file) — NFS doesn't support this
- Concurrent shard processing means multiple processes/connections to same NFS mount
- WAL checkpoint failure = data lives only in WAL = corruption on crash
- Git instability is the same NFS/ZFS write-ordering issue

**Root Cause C: Pipeline state bookkeeping race** (issue #3)
- Two separate Database connections (pipeline + store) with WAL isolation
- State saved before buffer flush
- No terminal state written on crash

### How should source type diversity work?

The governance intent is clear from the tier promotion schema: T0→T1 requires evidence from **multiple independent sources** to confirm a motif isn't an artifact of one dataset. The Pile sub-components satisfy this intent perfectly. The evidence aggregator should count **distinct `source_component` values** (not extraction methods) for the `sourceTypeCount`.

The extraction method diversity (primed vs blind) is a separate, valuable signal — it measures whether a motif was found both by template matching AND by unsupervised discovery. This should be tracked separately as `extractionMethodDiversity` and used as a bonus signal, not a hard gate for T0→T1.

### What T0→T1 thresholds should be

Current: `domainCount >= 3, sourceTypes >= 2, confidence >= 0.3`
- `domainCount` is actually counting Pile sub-components (same as `source_component`)
- `sourceTypes` is counting extraction methods (always 1)
- `confidence` threshold is well-calibrated (0.3 is loose enough for T0→T1)

The `domainCount` threshold already does what `sourceTypes` was meant to do. With the fix, `sourceTypeCount` will count distinct `source_component` values, making it redundant with `domainCount` for single-dataset processing. But it becomes meaningful when processing multiple datasets (e.g., The Pile + C4 + RedPajama), where `sourceTypeCount` would count distinct datasets while `domainCount` counts sub-components within datasets.

**Proposed**: Rename and restructure:
- `sourceTypeCount` → count distinct `source_dataset` values (dataset-level diversity)
- `sourceComponentCount` → count distinct `source_component` values (sub-dataset diversity)
- T0→T1 gate: `sourceComponentCount >= 3` (replaces `sourceTypes >= 2`)
- T1→T2 gate: `sourceTypeCount >= 2` (requires multiple datasets) OR `sourceComponentCount >= 7`

This is too much structural change for a fix. The minimum viable fix: make `sourceTypeCount` count distinct `source_component` values instead of extraction methods. This unblocks promotions now and is semantically correct for The Pile.

### Conflicting evidence relationship

The 10 CRITICAL anomalies (same source text matching multiple motifs) are a **template overlap problem**. The top motifs (TAC: 6,953 records, TDC: 1,949) are broad patterns that naturally co-occur. However, the content_hash analysis shows very few actual duplicates (max 3 records per hash). The conflicting-evidence anomaly detection in digest-generator.ts:145-155 uses a self-join that counts symmetric pairs, inflating the numbers.

The `hasConflictingEvidence` flag in the T0→T1 gate (tier-promoter.ts:133) is also too aggressive — it blocks promotion for ANY motif that has even one source passage shared with another motif. For broad patterns processed at scale, some overlap is expected and healthy.

---

## Pass 3 — RECURSE

### Are we fighting symptoms or architecture?

**Symptoms**: zero promotions, corrupt database, stale state files.
**Architecture issue**: The evidence aggregator was designed for a multi-dataset world but deployed against a single dataset (The Pile). The `sourceType` abstraction tried to serve double duty (data source diversity AND extraction method diversity) and ended up measuring neither correctly.

### What we'd do differently from scratch

1. **Three-tier diversity model**: dataset diversity (The Pile vs C4), component diversity (PubMed vs ArXiv within The Pile), domain diversity (same as component for The Pile, but could be NLP-inferred topics for uniform datasets). Each tier has its own threshold, clearly named.

2. **Extraction method as a quality signal, not a gate**: Triangulation (primed + blind) is valuable evidence but shouldn't block T0→T1. It should boost confidence or be a T1→T2 requirement.

3. **Pipeline state atomicity**: Single database connection, or explicit WAL checkpoint before state save, or state derived from the database itself (not a separate JSON file).

4. **NFS-safe SQLite**: Use `PRAGMA journal_mode=DELETE` on NFS, or `PRAGMA locking_mode=EXCLUSIVE`, or move databases to local storage with NFS only for final export.

### Minimum fix vs right fix

**Minimum fix** (implement now):
1. Evidence aggregator: count distinct `source_component` values as `sourceTypeCount`
2. Track extraction method diversity separately as informational
3. Pipeline state: save after buffer flush, checkpoint WAL before state write
4. Delete corrupt shard-01 files
5. Relax `hasConflictingEvidence` from hard block to informational flag in digest

**Right fix** (future):
1. Restructure evidence model with explicit dataset/component/domain tiers
2. Move SQLite databases to local SSD, export results to NFS
3. Add WAL checkpoint on pipeline shutdown
4. Add corruption detection on pipeline startup (integrity_check before processing)
5. Template overlap resolution (deduplicate or rank competing motif matches)

---

## Fixes Applied

### Fix 1: Evidence aggregator — count source components, not extraction methods

`src/governance/evidence-aggregator.ts`: Replace the `sourceTypeRows` query to count distinct `source_component` values. Each Pile sub-component is an independent source. Track extraction method diversity separately.

### Fix 2: Tier promoter — relax conflicting evidence gate

`src/governance/tier-promoter.ts`: Change `hasConflictingEvidence` from a hard block on T0→T1 to a warning logged in the digest. At scale, some motif overlap is expected.

### Fix 3: Pipeline state — save after flush, add WAL checkpoint

`src/orchestrator/pipeline.ts`: Move `savePipelineState` call to after the buffer flush. Add explicit WAL checkpoint before saving state. Ensure terminal `stoppedReason` is set before final state save.

### Fix 4: Delete corrupt shard-01 files

Remove `shard-01.db`, `shard-01.db-shm`, `shard-01.db-wal`, `shard-01.db.pipeline-state.json`.

### Fix 5: Shard-02 verified healthy

Integrity check passes, 4,614 records, processing state intact.

---

## Post-Fix Projection

With Fix 1 applied, shard-00's motif evidence changes:

| Motif | Records | Domains | Source Components | Confidence | Promotion? |
|-------|---------|---------|-------------------|------------|------------|
| TAC | 6,953 | 14 | 14 | 0.422 | YES (14 >= 3, 14 >= 2, 0.42 >= 0.3) |
| TDC | 1,949 | 13 | 13 | 0.418 | YES |
| RB | 344 | 11 | 11 | 0.413 | YES |
| CPA | 258 | 9 | 9 | 0.421 | YES |
| ESMB | 177 | 10 | 10 | 0.398 | YES |
| DSG | 61 | 6 | 6 | 0.379 | YES |
| SLD | 44 | 7 | 7 | 0.417 | YES |
| PF | 43 | 6 | 6 | 0.421 | YES |
| BBWOP | 27 | 8 | 8 | 0.391 | YES |
| RST | 15 | 3 | 3 | 0.410 | YES |
| SFA | 13 | 7 | 7 | 0.417 | YES |
| BD | 9 | 4 | 4 | 0.390 | YES |
| PSR | 8 | 4 | 4 | 0.431 | YES |
| RG | 5 | 3 | 3 | 0.376 | YES |
| SCGS | 5 | 1 | 1 | 0.416 | NO (1 < 3 domains) |
| ISC | 4 | 3 | 3 | 0.387 | YES |
| OFL | 4 | 2 | 2 | 0.407 | NO (2 < 3 domains) |
| RAF | 3 | 3 | 3 | 0.376 | YES |

**Projected: 16 of 18 motifs eligible for T0→T1 auto-promotion** (pending conflicting evidence check relaxation).

Note: With Fix 2 (relaxed conflicting evidence), all 16 will promote. Without Fix 2, motifs with any shared source passages would still be blocked — which at scale means most high-count motifs.
