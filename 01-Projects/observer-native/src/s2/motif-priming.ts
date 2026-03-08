/**
 * S2 — Motif Library Priming (PRD-20260309-s2-motif-library-priming)
 *
 * Surfaces relevant motif content at session start based on working context.
 * Scores each motif against recent session summaries and open tensions,
 * returning the top 5 with structural description snippets.
 *
 * Pure functions. No HTTP calls. No NLP/LLM inference. No external deps.
 */

import type { MotifEntry } from "./context-hydration.ts";
import type { SessionRecord, TensionGap } from "./session-capture.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A motif scored for relevance to the current session context. */
export interface PrimedMotif {
  name: string;
  tier: number;
  primaryAxis: string;
  confidence: number;
  description: string; // first sentence of Structural Description
  relevance: number;
  matchedSignals: string[]; // keywords that triggered the match
}

/** Parsed metadata from motif frontmatter. */
interface MotifMetadata {
  name: string;
  tier: number;
  confidence: number;
  primaryAxis: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum motifs to include in session-start priming. */
const MAX_PRIMED_MOTIFS = 5;

/** Minimum token length to consider a keyword (filters "a", "of", etc.). */
const MIN_KEYWORD_LENGTH = 3;

/** Common English stopwords to filter from context signal extraction. */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
  "new", "now", "old", "see", "way", "who", "did", "get", "let", "say",
  "she", "too", "use", "from", "this", "that", "with", "have", "will",
  "each", "make", "like", "been", "long", "very", "when", "what", "your",
  "them", "then", "than", "into", "some", "could", "other", "their",
  "there", "about", "which", "would", "these", "after", "also", "just",
  "more", "most", "only", "over", "such", "take", "were", "they",
  "tools", "events", "session", "status", "file", "files",
]);

// ---------------------------------------------------------------------------
// Frontmatter Parser
// ---------------------------------------------------------------------------

/**
 * Parses YAML frontmatter from motif markdown content.
 * Simple regex-based parser — no YAML library dependency.
 */
function parseFrontmatter(content: string): MotifMetadata | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const block = match[1];

  const nameMatch = block.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  const tierMatch = block.match(/^tier:\s*(\d+)\s*$/m);
  const confMatch = block.match(/^confidence:\s*([\d.]+)\s*$/m);
  const axisMatch = block.match(/^primary_axis:\s*(\w+)\s*$/m);

  if (!nameMatch || !tierMatch || !confMatch || !axisMatch) return null;

  return {
    name: nameMatch[1],
    tier: parseInt(tierMatch[1], 10),
    confidence: parseFloat(confMatch[1]),
    primaryAxis: axisMatch[1],
  };
}

/**
 * Extracts the first sentence from the ## Structural Description section.
 */
function extractStructuralDescription(content: string): string {
  const sectionMatch = content.match(
    /## Structural Description\s*\n\n([\s\S]*?)(?:\n\n##|\n\n\*|$)/,
  );
  if (!sectionMatch) return "";

  const paragraph = sectionMatch[1].trim();
  // First sentence: up to the first period followed by a space or end
  const sentenceMatch = paragraph.match(/^(.+?\.)\s/);
  return sentenceMatch ? sentenceMatch[1] : paragraph.slice(0, 120);
}

// ---------------------------------------------------------------------------
// Context Signal Extraction
// ---------------------------------------------------------------------------

/**
 * Extracts keywords from recent session summaries and open tensions.
 * Returns a Set of lowercased keywords for fast lookup.
 */
function extractContextSignals(
  recentSessions: SessionRecord[],
  openTensions: TensionGap[],
): Set<string> {
  const parts: string[] = [];

  for (const session of recentSessions) {
    if (session.summary) parts.push(session.summary);
    if (session.tensions) {
      for (const t of session.tensions) {
        if (t.status === "open") parts.push(t.description);
      }
    }
  }

  for (const tension of openTensions) {
    parts.push(tension.description);
    if (tension.relatedMotifs) {
      parts.push(tension.relatedMotifs.join(" "));
    }
  }

  const combined = parts.join(" ").toLowerCase();
  const tokens = combined.split(/[\s\-_.,;:!?()[\]{}"'`/\\|]+/);

  const keywords = new Set<string>();
  for (const token of tokens) {
    if (token.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(token)) {
      keywords.add(token);
    }
  }

  return keywords;
}

/**
 * Extracts keywords from a motif's filename and frontmatter name.
 */
function extractMotifKeywords(
  filename: string,
  name: string,
): string[] {
  const parts = filename
    .replace(/\.(md|json)$/, "")
    .split("-")
    .concat(name.toLowerCase().split(/[\s\-_]+/))
    .filter((t) => t.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(t));

  // Deduplicate
  return [...new Set(parts)];
}

// ---------------------------------------------------------------------------
// Relevance Scoring
// ---------------------------------------------------------------------------

/**
 * Scores motifs against context signals and returns the top N primed motifs.
 *
 * Relevance = keyword_match_score × tier_weight
 * Where:
 *   keyword_match_score = matched keywords / total motif keywords
 *   tier_weight = 0.5 + (0.5 × confidence)
 */
export function primeMotifs(
  motifs: MotifEntry[],
  recentSessions: SessionRecord[],
  openTensions: TensionGap[],
): PrimedMotif[] {
  const contextKeywords = extractContextSignals(recentSessions, openTensions);

  // If no context signals, return empty — nothing to match against
  if (contextKeywords.size === 0) return [];

  const scored: PrimedMotif[] = [];

  for (const motif of motifs) {
    // Skip index/schema/template files
    if (motif.filename.startsWith("_") || motif.filename === "MOTIF_INDEX.md") {
      continue;
    }
    // Skip analysis files (not actual motif entries)
    if (motif.filename.includes("Analysis") || motif.filename.includes("meta")) {
      continue;
    }

    const metadata = parseFrontmatter(motif.content);
    if (!metadata) continue;

    const motifKeywords = extractMotifKeywords(motif.filename, metadata.name);
    if (motifKeywords.length === 0) continue;

    // Score: proportion of motif keywords found in context
    const matched: string[] = [];
    for (const kw of motifKeywords) {
      if (contextKeywords.has(kw)) {
        matched.push(kw);
      }
    }

    if (matched.length === 0) continue;

    const keywordScore = matched.length / motifKeywords.length;
    const tierWeight = 0.5 + 0.5 * metadata.confidence;
    const relevance = keywordScore * tierWeight;

    scored.push({
      name: metadata.name,
      tier: metadata.tier,
      primaryAxis: metadata.primaryAxis,
      confidence: metadata.confidence,
      description: extractStructuralDescription(motif.content),
      relevance,
      matchedSignals: matched,
    });
  }

  // Sort by relevance descending, cap at MAX_PRIMED_MOTIFS
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, MAX_PRIMED_MOTIFS);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Formats primed motifs as concise priming text for session-start output.
 * ~150 chars per motif.
 */
export function formatPrimedMotifs(primed: PrimedMotif[]): string {
  if (primed.length === 0) return "";

  const lines = primed.map((m) => {
    const axis = m.primaryAxis.slice(0, 5); // diff, integ, recur
    return `• ${m.name} (T${m.tier}, ${axis}): ${m.description}`;
  });

  return "Relevant motifs:\n" + lines.join("\n");
}
