#!/usr/bin/env python3
"""
Tier B Enrichment Script — Structural analysis without spaCy dependency.

Reads source_raw_text from shard SQLite DBs and populates:
  - process_shape: extracted process descriptions (agent-action-patient)
  - process_operators: matched operators from motif algebra
  - process_temporal_structure: sequential/concurrent/cyclic/recursive
  - tier_b_score: structural match score (0.0-1.0)
  - stage: updated from 'amorphous' to 'structured'

Uses regex-based NLP for relationship extraction. Not as accurate as spaCy
dependency parsing, but works without the spaCy dependency and is fast enough
to enrich 10K records in minutes.

Usage:
    python3 scripts/enrich-tier-b.py --db output/shard-00.db [--batch-size 100] [--dry-run]
"""

import argparse
import json
import re
import sqlite3
import sys
import time
from collections import Counter
from dataclasses import dataclass


# ── Relationship extraction patterns ──────────────────────────────────────────
# These approximate spaCy's nsubj->VERB->dobj extraction via regex.

# Pattern: <NounPhrase> <Verb> <NounPhrase>
# Simple but effective for English process descriptions.
_NP = r"(?:(?:the|a|an|this|that|each|every|some|any|its|their|our)\s+)?(?:(?:\w+\s+){0,3}\w+)"
_VERB = r"(?:\w+(?:s|es|ed|ing|tion)?)"

# Agent-action-patient: "The system constrains the output"
PROCESS_RE = re.compile(
    rf"({_NP})\s+((?:is|are|was|were|has been|have been)\s+)?({_VERB}(?:ed|en)?)\s+(?:by\s+)?({_NP})",
    re.IGNORECASE,
)

# Simpler SVO pattern for common process verbs
PROCESS_VERBS = {
    "constrain", "govern", "regulate", "control", "restrict", "limit",
    "enforce", "generate", "produce", "create", "cause", "trigger",
    "enable", "prevent", "drive", "modify", "transform", "convert",
    "filter", "select", "classify", "compose", "decompose", "buffer",
    "accumulate", "converge", "diverge", "oscillate", "iterate",
    "recurse", "reflect", "observe", "measure", "evaluate", "optimize",
    "adapt", "evolve", "couple", "decouple", "synchronize", "coordinate",
    "propagate", "transmit", "encode", "decode", "compress", "expand",
    "scaffold", "bootstrap", "formalize", "crystallize", "dissolve",
}

SVO_RE = re.compile(
    rf"\b({_NP})\s+({_VERB}s?)\s+({_NP})\b",
    re.IGNORECASE,
)

# ── Governance patterns ──────────────────────────────────────────────────────

GOVERNANCE_VERBS_SET = frozenset({
    "constrain", "constrains", "constrained", "constraining",
    "govern", "governs", "governed", "governing",
    "regulate", "regulates", "regulated", "regulating",
    "control", "controls", "controlled", "controlling",
    "restrict", "restricts", "restricted", "restricting",
    "limit", "limits", "limited", "limiting",
    "enforce", "enforces", "enforced", "enforcing",
    "mandate", "mandates", "mandated", "mandating",
    "oversee", "oversees", "oversaw", "overseeing",
    "supervise", "supervises", "supervised", "supervising",
    "dictate", "dictates", "dictated", "dictating",
    "prescribe", "prescribes", "prescribed", "prescribing",
    "determine", "determines", "determined", "determining",
    "bind", "binds", "bound", "binding",
})

GOVERNANCE_RE = re.compile(
    rf"\b({_NP})\s+({'|'.join(sorted(GOVERNANCE_VERBS_SET, key=len, reverse=True))})\s+({_NP})\b",
    re.IGNORECASE,
)

# ── Temporal markers ─────────────────────────────────────────────────────────

TEMPORAL_CONNECTORS = frozenset({
    "before", "after", "while", "during", "then", "next",
    "subsequently", "previously", "finally", "initially",
    "meanwhile", "simultaneously", "eventually", "thereafter",
    "once", "until", "since", "when", "whenever", "already",
    "first", "second", "third", "lastly", "afterward",
})

SEQUENTIAL_MARKERS = {"then", "next", "subsequently", "afterward", "following",
                       "finally", "first", "second", "third", "lastly",
                       "before", "after", "previously", "initially"}
CONCURRENT_MARKERS = {"while", "during", "meanwhile", "simultaneously",
                       "concurrently", "parallel", "at the same time"}
CYCLIC_MARKERS = {"again", "repeatedly", "cycle", "loop", "iterate",
                   "periodic", "recurring", "return", "repeat"}
RECURSIVE_MARKERS = {"self", "recursive", "meta", "nested", "self-referential",
                      "reflexive", "introspect"}

# ── Motif operator vocabulary ─────────────────────────────────────────────────

MOTIF_OPERATORS = {
    "DSG": ["bifurcate", "oscillate", "constrain", "delegate"],
    "CPA": ["compose", "register", "dispatch", "extend"],
    "ESMB": ["transition", "guard", "enumerate", "validate"],
    "BBWOP": ["buffer", "overflow", "evict", "throttle"],
    "ISC": ["converge", "reconcile", "detect", "correct"],
    "OFL": ["observe", "modify", "reflect", "recurse"],
    "RAF": ["accumulate", "lock", "constrain", "resist"],
    "PF": ["refine", "stage", "crystallize", "promote"],
    "RB": ["compress", "lose", "reconstruct", "degrade"],
    "TAC": ["curate", "rank", "endorse", "filter"],
    "RST": ["dissolve", "transform", "shed", "reorganize"],
    "BD": ["erode", "blur", "shift", "creep"],
    "SCGS": ["couple", "adapt", "entangle", "constrain"],
    "SLD": ["guarantee", "deadlock", "starve", "invariant"],
    "RG": ["generate", "bootstrap", "scaffold", "emerge"],
    "PSR": ["refer", "describe", "fixpoint", "introspect"],
    "TDC": ["classify", "template", "label", "categorize"],
    "SFA": ["scaffold", "skeleton", "prototype", "bootstrap"],
}


# ── Extraction functions ─────────────────────────────────────────────────────

@dataclass
class ProcessRelationship:
    agent: str
    action: str
    patient: str
    rel_type: str  # causal, temporal, governance, constraint


@dataclass
class GovernanceRelationship:
    governor: str
    governed: str
    mechanism: str


@dataclass
class StructuralAnalysis:
    process_relationships: list[ProcessRelationship]
    governance_relationships: list[GovernanceRelationship]
    temporal_connectors: list[str]
    temporal_structure: str | None  # sequential/concurrent/cyclic/recursive
    operators: list[str]
    process_shape: str
    tier_b_score: float
    verb_actions: set[str]


CAUSAL_VERBS = frozenset({
    "cause", "causes", "caused", "produce", "produces", "produced",
    "lead", "leads", "led", "trigger", "triggers", "triggered",
    "enable", "enables", "enabled", "prevent", "prevents", "prevented",
    "generate", "generates", "generated", "create", "creates", "created",
    "drive", "drives", "drove", "induce", "induces", "induced",
})

TEMPORAL_VERBS = frozenset({
    "precede", "precedes", "preceded", "follow", "follows", "followed",
    "begin", "begins", "began", "end", "ends", "ended",
    "start", "starts", "started", "finish", "finishes", "finished",
    "continue", "continues", "continued", "occur", "occurs", "occurred",
})


def classify_verb(verb_text: str) -> str:
    lower = verb_text.lower()
    if lower in GOVERNANCE_VERBS_SET:
        return "governance"
    if lower in CAUSAL_VERBS:
        return "causal"
    if lower in TEMPORAL_VERBS:
        return "temporal"
    return "constraint"


def extract_relationships(text: str, max_chars: int = 8000) -> tuple[list[ProcessRelationship], set[str]]:
    """Extract agent-action-patient relationships from text."""
    text = text[:max_chars]
    relationships = []
    seen = set()
    verb_actions = set()

    # Split into sentences (rough)
    sentences = re.split(r'[.!?]\s+', text)

    for sent in sentences[:100]:  # Cap at 100 sentences
        sent = sent.strip()
        if len(sent) < 10 or len(sent) > 500:
            continue

        # Look for SVO patterns with process verbs
        for m in SVO_RE.finditer(sent):
            agent, verb, patient = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            verb_lower = verb.lower().rstrip("s").rstrip("e")

            # Only keep if the verb stem matches a process verb
            is_process = False
            for pv in PROCESS_VERBS:
                if verb_lower.startswith(pv[:4]) or pv.startswith(verb_lower[:4]):
                    is_process = True
                    break

            if is_process and len(agent) > 2 and len(patient) > 2:
                key = (agent.lower()[:20], verb_lower[:10], patient.lower()[:20])
                if key not in seen:
                    seen.add(key)
                    verb_actions.add(verb.lower())
                    relationships.append(ProcessRelationship(
                        agent=agent[:50],
                        action=verb,
                        patient=patient[:50],
                        rel_type=classify_verb(verb),
                    ))

    return relationships[:20], verb_actions  # Cap at 20


def extract_governance(text: str, max_chars: int = 8000) -> list[GovernanceRelationship]:
    """Extract governance relationships (X governs/constrains Y)."""
    text = text[:max_chars]
    rels = []
    for m in GOVERNANCE_RE.finditer(text):
        governor = m.group(1).strip()[:50]
        mechanism = m.group(2).strip().lower()
        governed = m.group(3).strip()[:50]
        if len(governor) > 2 and len(governed) > 2:
            # Normalize mechanism to lemma
            for base in ["constrain", "govern", "regulate", "control", "restrict",
                         "limit", "enforce", "mandate", "oversee", "supervise",
                         "dictate", "prescribe", "determine", "bind"]:
                if mechanism.startswith(base[:5]):
                    mechanism = base
                    break
            rels.append(GovernanceRelationship(governor, governed, mechanism))
    return rels[:10]


def extract_temporal_connectors(text: str, max_chars: int = 8000) -> list[str]:
    """Find temporal connector words in text."""
    text = text[:max_chars].lower()
    found = []
    seen = set()
    for word in re.findall(r'\b\w+\b', text):
        if word in TEMPORAL_CONNECTORS and word not in seen:
            seen.add(word)
            found.append(word)
    return found


def detect_temporal_structure(connectors: list[str], text: str) -> str | None:
    """Detect the dominant temporal structure."""
    words = set(re.findall(r'\b\w+\b', text[:8000].lower()))

    seq_score = sum(1 for w in words if w in SEQUENTIAL_MARKERS)
    con_score = sum(1 for w in words if w in CONCURRENT_MARKERS)
    cyc_score = sum(1 for w in words if w in CYCLIC_MARKERS)
    rec_score = sum(1 for w in words if w in RECURSIVE_MARKERS)

    max_score = max(seq_score, con_score, cyc_score, rec_score)
    if max_score == 0:
        return None

    # Specificity ordering: recursive > cyclic > concurrent > sequential
    if rec_score == max_score and rec_score >= 2:
        return "recursive"
    if cyc_score == max_score and cyc_score >= 2:
        return "cyclic"
    if con_score == max_score and con_score >= 2:
        return "concurrent"
    if seq_score >= 1:
        return "sequential"

    return None


def match_operators(verb_actions: set[str], motif_id: str) -> list[str]:
    """Match verb actions against expected motif operators."""
    expected = MOTIF_OPERATORS.get(motif_id, [])
    if not expected:
        return []

    matched = []
    for op in expected:
        for verb in verb_actions:
            if verb.startswith(op[:5]) or op.startswith(verb[:5]):
                matched.append(op)
                break
    return matched


def describe_process_shape(
    relationships: list[ProcessRelationship],
    governance: list[GovernanceRelationship],
    temporal: str | None,
) -> str:
    """Generate a concise process shape description."""
    parts = []

    if relationships:
        top = relationships[:3]
        descs = [f"{r.agent} {r.action} {r.patient}" for r in top]
        parts.append(f"Process: {'; '.join(descs)}")

    if governance:
        gov_descs = [f"{g.governor} {g.mechanism} {g.governed}" for g in governance[:2]]
        parts.append(f"Governance: {'; '.join(gov_descs)}")

    if temporal:
        parts.append(f"Temporal: {temporal}")

    if not parts:
        return "No structural process detected"

    return " | ".join(parts)


def score_structural_match(
    relationships: list[ProcessRelationship],
    governance: list[GovernanceRelationship],
    connectors: list[str],
    operators: list[str],
    motif_id: str,
    axis: str,
    temporal_structure: str | None,
) -> float:
    """
    Score the structural match. Replicates the TypeScript scoring logic.
    """
    # Process relationship score
    if relationships:
        density = min(len(relationships) / 5, 1.0)
        types = set(r.rel_type for r in relationships)
        diversity = len(types) / 4

        alignment = 0.0
        if axis == "integrate" and "governance" in types:
            alignment = 0.15
        if axis == "recurse" and "causal" in types:
            alignment = 0.1

        proc_score = min(density * 0.5 + diversity * 0.3 + alignment + 0.2 * min(density, 0.5), 1.0)
    else:
        proc_score = 0.0

    # Temporal score
    if temporal_structure:
        temp_score = 0.3
        temp_score += min(len(connectors) / 4, 1.0) * 0.3
        # Derivative order alignment would need indicator sets — approximate
        if axis == "recurse" and temporal_structure == "recursive":
            temp_score += 0.2
        if axis == "integrate" and temporal_structure in ("sequential", "cyclic"):
            temp_score += 0.1
        temp_score = min(temp_score, 1.0)
    else:
        temp_score = 0.0

    # Governance score
    if governance:
        gov_score = 0.3 + min(len(governance) / 3, 0.4)
        governance_motifs = {"DSG", "ISC", "SLD", "SCGS", "TAC"}
        if motif_id in governance_motifs:
            gov_score += 0.3
        gov_score = min(gov_score, 1.0)
    else:
        gov_score = 0.0

    # Operator score
    expected_ops = MOTIF_OPERATORS.get(motif_id, [])
    op_score = len(operators) / len(expected_ops) if expected_ops else 0.0

    # Overall: same weights as TypeScript scorer
    overall = min(
        proc_score * 0.35 +
        temp_score * 0.20 +
        gov_score * 0.20 +
        op_score * 0.25,
        1.0,
    )

    return round(overall, 4)


def analyze_record(raw_text: str, motif_id: str, axis: str) -> StructuralAnalysis:
    """Full structural analysis of a single record."""
    relationships, verb_actions = extract_relationships(raw_text)
    governance = extract_governance(raw_text)
    connectors = extract_temporal_connectors(raw_text)
    temporal = detect_temporal_structure(connectors, raw_text)
    operators = match_operators(verb_actions, motif_id)
    shape = describe_process_shape(relationships, governance, temporal)
    score = score_structural_match(
        relationships, governance, connectors, operators,
        motif_id, axis, temporal,
    )

    return StructuralAnalysis(
        process_relationships=relationships,
        governance_relationships=governance,
        temporal_connectors=connectors,
        temporal_structure=temporal,
        operators=operators,
        process_shape=shape,
        tier_b_score=score,
        verb_actions=verb_actions,
    )


def main():
    parser = argparse.ArgumentParser(description="Tier B enrichment for existing shard DBs")
    parser.add_argument("--db", required=True, help="Path to shard DB")
    parser.add_argument("--batch-size", type=int, default=100, help="Records per batch commit")
    parser.add_argument("--limit", type=int, default=0, help="Max records to process (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="Analyze but don't write to DB")
    parser.add_argument("--stats-only", action="store_true", help="Only print statistics")
    args = parser.parse_args()

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Tier B enrichment for {args.db}")

    # Open DB
    if args.dry_run:
        conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    else:
        conn = sqlite3.connect(args.db)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")

    # Count records
    total = conn.execute("SELECT COUNT(*) FROM verb_records").fetchone()[0]
    unanalyzed = conn.execute(
        "SELECT COUNT(*) FROM verb_records WHERE process_shape = 'unanalyzed' OR process_shape IS NULL"
    ).fetchone()[0]
    print(f"  Total records: {total:,}")
    print(f"  Unanalyzed: {unanalyzed:,}")

    if unanalyzed == 0:
        print("  Nothing to enrich. Exiting.")
        return

    # Load records to process
    query = """
        SELECT id, source_raw_text, motif_id, process_axis
        FROM verb_records
        WHERE process_shape = 'unanalyzed' OR process_shape IS NULL
    """
    if args.limit > 0:
        query += f" LIMIT {args.limit}"

    rows = conn.execute(query).fetchall()
    print(f"  Processing {len(rows):,} records...")

    # Process
    t0 = time.time()
    stats = {
        "processed": 0,
        "with_relationships": 0,
        "with_governance": 0,
        "with_temporal": 0,
        "with_operators": 0,
        "score_sum": 0.0,
        "score_nonzero": 0,
        "temporal_types": Counter(),
        "operator_counts": Counter(),
        "shape_noprocess": 0,
    }

    batch_updates = []

    for i, (rec_id, raw_text, motif_id, axis) in enumerate(rows):
        if not raw_text or len(raw_text) < 20:
            continue

        analysis = analyze_record(raw_text, motif_id or "", axis or "")

        stats["processed"] += 1
        if analysis.process_relationships:
            stats["with_relationships"] += 1
        if analysis.governance_relationships:
            stats["with_governance"] += 1
        if analysis.temporal_structure:
            stats["with_temporal"] += 1
            stats["temporal_types"][analysis.temporal_structure] += 1
        if analysis.operators:
            stats["with_operators"] += 1
            for op in analysis.operators:
                stats["operator_counts"][op] += 1
        stats["score_sum"] += analysis.tier_b_score
        if analysis.tier_b_score > 0:
            stats["score_nonzero"] += 1
        if analysis.process_shape == "No structural process detected":
            stats["shape_noprocess"] += 1

        if not args.dry_run and not args.stats_only:
            batch_updates.append((
                analysis.process_shape,
                json.dumps(analysis.operators),
                analysis.temporal_structure,
                analysis.tier_b_score,
                "structured" if analysis.tier_b_score > 0 else "amorphous",
                rec_id,
            ))

            if len(batch_updates) >= args.batch_size:
                conn.executemany("""
                    UPDATE verb_records SET
                        process_shape = ?,
                        process_operators = ?,
                        process_temporal_structure = ?,
                        tier_b_score = ?,
                        stage = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                """, batch_updates)
                conn.commit()
                batch_updates = []

        if (i + 1) % 1000 == 0:
            elapsed = time.time() - t0
            rate = (i + 1) / elapsed
            eta = (len(rows) - i - 1) / rate if rate > 0 else 0
            print(f"  [{i+1:,}/{len(rows):,}] {rate:.0f} rec/s, ETA {eta:.0f}s")

    # Final batch
    if batch_updates and not args.dry_run and not args.stats_only:
        conn.executemany("""
            UPDATE verb_records SET
                process_shape = ?,
                process_operators = ?,
                process_temporal_structure = ?,
                tier_b_score = ?,
                stage = ?,
                updated_at = datetime('now')
            WHERE id = ?
        """, batch_updates)
        conn.commit()

    elapsed = time.time() - t0
    conn.close()

    # Print results
    n = stats["processed"]
    print(f"\n{'='*60}")
    print(f"TIER B ENRICHMENT RESULTS")
    print(f"{'='*60}")
    print(f"Records processed:    {n:,}")
    print(f"Time:                 {elapsed:.1f}s ({n/elapsed:.0f} rec/s)")
    print(f"")
    print(f"Process relationships: {stats['with_relationships']:,} ({stats['with_relationships']/n:.1%})")
    print(f"Governance patterns:  {stats['with_governance']:,} ({stats['with_governance']/n:.1%})")
    print(f"Temporal structure:   {stats['with_temporal']:,} ({stats['with_temporal']/n:.1%})")
    print(f"Operator matches:     {stats['with_operators']:,} ({stats['with_operators']/n:.1%})")
    print(f"No process detected:  {stats['shape_noprocess']:,} ({stats['shape_noprocess']/n:.1%})")
    print(f"Score > 0:            {stats['score_nonzero']:,} ({stats['score_nonzero']/n:.1%})")
    if stats["score_nonzero"] > 0:
        print(f"Avg score (nonzero):  {stats['score_sum']/stats['score_nonzero']:.4f}")

    print(f"\nTemporal structure breakdown:")
    for ts, cnt in stats["temporal_types"].most_common():
        print(f"  {ts}: {cnt:,}")

    if stats["operator_counts"]:
        print(f"\nTop operators matched:")
        for op, cnt in stats["operator_counts"].most_common(20):
            print(f"  {op}: {cnt:,}")

    if args.dry_run:
        print(f"\n[DRY RUN] No changes written to database.")
    elif not args.stats_only:
        print(f"\nDatabase updated: {args.db}")


if __name__ == "__main__":
    main()
