/**
 * Substrate indicator detection for classifying ideal vs applied space.
 *
 * Substrate keywords indicate the text describes an applied/physical system
 * rather than an ideal/abstract composition.
 */

const SUBSTRATE_KEYWORDS = [
  "noise",
  "drift",
  "decay",
  "lag",
  "atrophy",
  "overshoot",
  "degradation",
  "erosion",
  "friction",
  "delay",
  "distortion",
  "blur",
];

export function detectSubstrate(text: string): {
  detected: boolean;
  indicators: string[];
} {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const keyword of SUBSTRATE_KEYWORDS) {
    // Word boundary match to avoid partial matches
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(lower)) {
      found.push(keyword);
    }
  }

  return {
    detected: found.length > 0,
    indicators: found,
  };
}
