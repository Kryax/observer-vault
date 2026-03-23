/**
 * Lexical Filtering Engine — scores document text against indicator sets.
 *
 * Algorithm:
 * 1. Split document into paragraphs (double newline boundaries)
 * 2. For each paragraph of sufficient length (>100 chars):
 *    a. Lowercase the text
 *    b. Score against each indicator set via simple string matching
 *    c. If 3+ indicators match for any motif, paragraph is a candidate
 * 3. Documents with zero candidates are rejected
 */

import { INDICATOR_SETS, type IndicatorSet } from "./indicator-sets.ts";

export interface MotifScore {
  motifId: string;
  score: number;           // 0.0-1.0 normalized
  matchedIndicators: string[];
  indicatorCount: number;
}

export interface CandidatePassage {
  text: string;
  charOffset: [number, number];  // start, end offsets in original document
  motifScores: MotifScore[];
  topMotifId: string;
  topScore: number;
}

export interface FilterResult {
  candidates: CandidatePassage[];
  documentMotifScores: MotifScore[];
  rejected: boolean;
}

const MIN_PARAGRAPH_LENGTH = 100;
const MIN_INDICATOR_MATCHES = 3;

/**
 * Split text into paragraphs on double-newline boundaries.
 * Returns paragraphs with their character offsets in the original text.
 */
function splitParagraphs(text: string): Array<{ text: string; start: number; end: number }> {
  const results: Array<{ text: string; start: number; end: number }> = [];
  // Split on two or more consecutive newlines (with optional whitespace between)
  const parts = text.split(/\n\s*\n/);
  let offset = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    // Find where this part actually starts in the original text
    const startIdx = text.indexOf(part, offset);
    if (startIdx === -1) {
      offset += part.length + 2; // approximate
      continue;
    }
    if (trimmed.length >= MIN_PARAGRAPH_LENGTH) {
      results.push({
        text: trimmed,
        start: startIdx,
        end: startIdx + part.length,
      });
    }
    offset = startIdx + part.length;
  }

  return results;
}

/**
 * Score a lowercased text against a single indicator set.
 */
function scoreAgainstIndicatorSet(lowerText: string, indicatorSet: IndicatorSet): MotifScore {
  const matched: string[] = [];
  let weightedSum = 0;
  let maxPossibleWeight = 0;

  for (const indicator of indicatorSet.indicators) {
    maxPossibleWeight += indicator.weight;
    if (lowerText.indexOf(indicator.term) !== -1) {
      matched.push(indicator.term);
      weightedSum += indicator.weight;
    }
  }

  return {
    motifId: indicatorSet.motifId,
    score: maxPossibleWeight > 0 ? weightedSum / maxPossibleWeight : 0,
    matchedIndicators: matched,
    indicatorCount: matched.length,
  };
}

/**
 * Score a text passage against all indicator sets, returning qualifying scores.
 * A score qualifies if it has >= minMatches indicators and score >= minScore.
 */
function scorePassage(
  lowerText: string,
  minMatches: number,
  minScore: number,
): { scores: MotifScore[]; topMotifId: string; topScore: number } {
  const scores: MotifScore[] = [];
  let topScore = 0;
  let topMotifId = "";

  for (const indicatorSet of INDICATOR_SETS) {
    const score = scoreAgainstIndicatorSet(lowerText, indicatorSet);
    if (score.indicatorCount >= minMatches && score.score >= minScore) {
      scores.push(score);
      if (score.score > topScore) {
        topScore = score.score;
        topMotifId = score.motifId;
      }
    }
  }

  return { scores, topMotifId, topScore };
}

/**
 * Filter a single document, returning candidate passages and scores.
 *
 * Two-pass strategy:
 * 1. Try paragraph-level matching (3+ indicators per paragraph)
 * 2. If no paragraph candidates, score the full document as a single passage
 *
 * This handles both long documents with concentrated motif paragraphs
 * and shorter documents where indicators are distributed across the text.
 */
export function filterDocument(text: string, minScore: number = 0.3): FilterResult {
  const paragraphs = splitParagraphs(text);
  const candidates: CandidatePassage[] = [];

  // Pass 1: paragraph-level scoring
  for (const para of paragraphs) {
    const lowerText = para.text.toLowerCase();
    const { scores, topMotifId, topScore } = scorePassage(
      lowerText,
      MIN_INDICATOR_MATCHES,
      minScore,
    );

    if (scores.length > 0) {
      candidates.push({
        text: para.text,
        charOffset: [para.start, para.end],
        motifScores: scores,
        topMotifId,
        topScore,
      });
    }
  }

  // Pass 2: if no paragraph-level candidates, try document-level
  // Score the full document text. If it qualifies, emit as a single candidate
  // with a truncated text window (first 2000 chars for manageability).
  if (candidates.length === 0 && text.length >= MIN_PARAGRAPH_LENGTH) {
    const lowerFull = text.toLowerCase();
    const { scores, topMotifId, topScore } = scorePassage(
      lowerFull,
      MIN_INDICATOR_MATCHES,
      minScore,
    );

    if (scores.length > 0) {
      // For very large documents, emit a reasonable text window
      const maxPassageLen = 4000;
      const passageText = text.length > maxPassageLen
        ? text.slice(0, maxPassageLen)
        : text;

      candidates.push({
        text: passageText,
        charOffset: [0, passageText.length],
        motifScores: scores,
        topMotifId,
        topScore,
      });
    }
  }

  // Build document-level motif scores from full text
  const lowerFull = text.toLowerCase();
  const documentMotifScores: MotifScore[] = [];
  for (const indicatorSet of INDICATOR_SETS) {
    const score = scoreAgainstIndicatorSet(lowerFull, indicatorSet);
    if (score.indicatorCount > 0) {
      documentMotifScores.push(score);
    }
  }

  return {
    candidates,
    documentMotifScores,
    rejected: candidates.length === 0,
  };
}
