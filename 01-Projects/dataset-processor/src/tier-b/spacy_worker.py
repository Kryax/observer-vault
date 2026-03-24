#!/usr/bin/env python3
"""
spaCy subprocess worker — reads JSONL from stdin, writes parsed results to stdout.

Protocol:
  Input (stdin):  {"texts": ["text1", "text2", ...]}
  Output (stdout): one SpacyParseResult JSON per line, then {"batch_done": true, "count": N}
  Shutdown:        {"shutdown": true}

Extracts:
  - Dependency parse tokens (text, pos, dep, head)
  - Process relationships (agent-action-patient from nsubj/dobj chains)
  - Temporal connectors (before, after, while, then, etc.)
  - Governance relationships (X constrains/governs/regulates Y patterns)
"""

import json
import sys
import signal
import traceback

import spacy
from spacy.tokens import Doc, Token

# ── Temporal connector vocabulary ────────────────────────────────────────────

TEMPORAL_CONNECTORS = frozenset({
    "before", "after", "while", "during", "then", "next",
    "subsequently", "previously", "finally", "initially",
    "meanwhile", "simultaneously", "eventually", "thereafter",
    "once", "until", "since", "when", "whenever", "already",
    "first", "second", "third", "lastly", "afterward",
    "beforehand", "henceforth", "formerly", "lately",
})

# ── Governance verb patterns ─────────────────────────────────────────────────

GOVERNANCE_VERBS = frozenset({
    "constrain", "constrains", "constrained",
    "govern", "governs", "governed",
    "regulate", "regulates", "regulated",
    "control", "controls", "controlled",
    "restrict", "restricts", "restricted",
    "limit", "limits", "limited",
    "enforce", "enforces", "enforced",
    "mandate", "mandates", "mandated",
    "oversee", "oversees", "oversaw",
    "supervise", "supervises", "supervised",
    "dictate", "dictates", "dictated",
    "prescribe", "prescribes", "prescribed",
    "determine", "determines", "determined",
    "bind", "binds", "bound",
})

# ── Relationship type classification ─────────────────────────────────────────

CAUSAL_VERBS = frozenset({
    "cause", "causes", "caused", "causing",
    "produce", "produces", "produced", "producing",
    "lead", "leads", "led", "leading",
    "result", "results", "resulted", "resulting",
    "trigger", "triggers", "triggered", "triggering",
    "enable", "enables", "enabled", "enabling",
    "prevent", "prevents", "prevented", "preventing",
    "generate", "generates", "generated", "generating",
    "create", "creates", "created", "creating",
    "drive", "drives", "drove", "driving",
    "induce", "induces", "induced", "inducing",
    "force", "forces", "forced", "forcing",
})

TEMPORAL_VERBS = frozenset({
    "precede", "precedes", "preceded", "preceding",
    "follow", "follows", "followed", "following",
    "begin", "begins", "began", "beginning",
    "end", "ends", "ended", "ending",
    "start", "starts", "started", "starting",
    "finish", "finishes", "finished", "finishing",
    "continue", "continues", "continued", "continuing",
    "occur", "occurs", "occurred", "occurring",
    "happen", "happens", "happened", "happening",
})


def classify_relationship(verb_text: str) -> str:
    """Classify a verb into a relationship type."""
    lower = verb_text.lower()
    if lower in GOVERNANCE_VERBS:
        return "governance"
    if lower in CAUSAL_VERBS:
        return "causal"
    if lower in TEMPORAL_VERBS:
        return "temporal"
    return "constraint"


def get_subtree_text(token: Token) -> str:
    """Get the text of a token's subtree, limited to avoid huge spans."""
    subtree_tokens = sorted(token.subtree, key=lambda t: t.i)
    # Limit to 8 tokens to keep things concise
    if len(subtree_tokens) > 8:
        subtree_tokens = subtree_tokens[:8]
    return " ".join(t.text for t in subtree_tokens)


def extract_process_relationships(doc: Doc) -> list[dict]:
    """
    Extract agent-action-patient triples from dependency parse.
    Looks for nsubj -> VERB -> dobj/attr/prep chains.
    """
    relationships = []
    seen = set()

    for token in doc:
        if token.pos_ != "VERB":
            continue

        agent = None
        patient = None

        for child in token.children:
            if child.dep_ in ("nsubj", "nsubjpass"):
                agent = get_subtree_text(child)
            elif child.dep_ in ("dobj", "attr", "oprd"):
                patient = get_subtree_text(child)
            elif child.dep_ == "prep":
                # Look for prepositional object as patient
                for pobj in child.children:
                    if pobj.dep_ == "pobj" and patient is None:
                        patient = get_subtree_text(pobj)

        if agent and patient:
            key = (agent, token.lemma_, patient)
            if key not in seen:
                seen.add(key)
                relationships.append({
                    "agent": agent,
                    "action": token.text,
                    "patient": patient,
                    "type": classify_relationship(token.text),
                })

    return relationships


def extract_temporal_connectors(doc: Doc) -> list[str]:
    """Extract temporal connector words/phrases found in the document."""
    found = []
    seen = set()
    for token in doc:
        lower = token.text.lower()
        if lower in TEMPORAL_CONNECTORS and lower not in seen:
            seen.add(lower)
            found.append(lower)
    return found


def extract_governance_relationships(doc: Doc) -> list[dict]:
    """
    Extract governance relationships: patterns like "X constrains Y",
    "X governs Y", "X regulates Y".
    """
    relationships = []

    for token in doc:
        if token.text.lower() not in GOVERNANCE_VERBS:
            continue

        governor = None
        governed = None

        for child in token.children:
            if child.dep_ in ("nsubj", "nsubjpass"):
                governor = get_subtree_text(child)
            elif child.dep_ in ("dobj", "attr", "oprd"):
                governed = get_subtree_text(child)
            elif child.dep_ == "prep":
                for pobj in child.children:
                    if pobj.dep_ == "pobj" and governed is None:
                        governed = get_subtree_text(pobj)

        if governor and governed:
            relationships.append({
                "governor": governor,
                "governed": governed,
                "mechanism": token.lemma_,
            })

    return relationships


def process_single(doc: Doc, doc_index: int) -> dict:
    """Process a single spaCy Doc into a SpacyParseResult."""
    tokens = []
    for token in doc:
        tokens.append({
            "text": token.text,
            "pos": token.pos_,
            "dep": token.dep_,
            "head": token.head.i,
        })

    return {
        "docIndex": doc_index,
        "tokens": tokens,
        "processRelationships": extract_process_relationships(doc),
        "temporalConnectors": extract_temporal_connectors(doc),
        "governanceRelationships": extract_governance_relationships(doc),
    }


def main():
    """Main loop: read JSONL from stdin, write parsed results to stdout."""
    # Determine model from argv or default
    model_name = sys.argv[1] if len(sys.argv) > 1 else "en_core_web_md"

    # Signal handlers for clean shutdown
    def handle_signal(signum, frame):
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    # Load model — write ready signal AFTER loading
    try:
        nlp = spacy.load(model_name)
    except OSError:
        # Model not installed — report error and exit
        err = {"error": f"spaCy model '{model_name}' not found. Install with: python -m spacy download {model_name}"}
        sys.stdout.write(json.dumps(err) + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # Ready signal
    sys.stdout.write(json.dumps({"ready": True, "model": model_name}) + "\n")
    sys.stdout.flush()

    # Main processing loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps({"error": "invalid JSON"}) + "\n")
            sys.stdout.flush()
            continue

        # Shutdown command
        if msg.get("shutdown"):
            break

        # Batch processing
        texts = msg.get("texts", [])
        if not texts:
            sys.stdout.write(json.dumps({"batch_done": True, "count": 0}) + "\n")
            sys.stdout.flush()
            continue

        # Use nlp.pipe for efficient batch processing
        docs = list(nlp.pipe(texts, batch_size=min(len(texts), 64)))

        for i, doc in enumerate(docs):
            result = process_single(doc, i)
            sys.stdout.write(json.dumps(result) + "\n")
            sys.stdout.flush()

        # Batch end marker
        sys.stdout.write(json.dumps({"batch_done": True, "count": len(docs)}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
