// S3: Dual-layer credential sanitizer
// Layer 1: Regex pattern matching for known credential formats
// Layer 2: Shannon entropy detection near credential context words
// Returns sanitized copy — never mutates input

const REDACTED = "[REDACTED]";

// --- Layer 1: Known credential patterns ---

const CREDENTIAL_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  // OpenAI API keys
  { name: "openai_key", pattern: /sk-[a-zA-Z0-9]{20,}/g },
  // Google API keys
  { name: "google_key", pattern: /AIza[a-zA-Z0-9_-]{35}/g },
  // GitHub Personal Access Tokens
  { name: "github_pat", pattern: /ghp_[a-zA-Z0-9]{36}/g },
  // GitHub fine-grained tokens
  { name: "github_fine", pattern: /github_pat_[a-zA-Z0-9_]{20,}/g },
  // AWS access keys
  { name: "aws_key", pattern: /AKIA[A-Z0-9]{16}/g },
  // JWT tokens (three base64url segments separated by dots)
  { name: "jwt", pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
  // Generic Bearer tokens in header-like contexts
  { name: "bearer", pattern: /Bearer\s+[a-zA-Z0-9_\-.]{20,}/g },
  // Sensitive file paths
  {
    name: "sensitive_path",
    pattern: /(?:\/[\w.-]+)*\/(?:\.env(?:\.\w+)?|credentials(?:\.json)?|secrets(?:\.ya?ml)?|tokens(?:\.json)?)/g,
  },
];

// --- Layer 2: Entropy-based detection ---

const CONTEXT_WORDS = new Set([
  "key",
  "token",
  "secret",
  "password",
  "credential",
  "auth",
  "bearer",
  "api_key",
  "apikey",
  "api-key",
  "access_token",
  "private_key",
]);

const ENTROPY_THRESHOLD = 4.5;
const MIN_TOKEN_LENGTH = 16;

/**
 * Calculate Shannon entropy of a string.
 * Higher entropy means more randomness — likely a secret.
 */
function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  const len = s.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Check if a word appears near a credential context word in the surrounding text.
 * "Near" means within 60 characters in either direction.
 */
function isNearContextWord(text: string, matchStart: number, matchEnd: number): boolean {
  const windowStart = Math.max(0, matchStart - 60);
  const windowEnd = Math.min(text.length, matchEnd + 60);
  const window = text.slice(windowStart, windowEnd).toLowerCase();

  for (const word of CONTEXT_WORDS) {
    if (window.includes(word)) return true;
  }
  return false;
}

/**
 * Layer 2: Find high-entropy tokens near credential context words.
 * Splits on whitespace/punctuation and checks each token.
 */
function findEntropyMatches(text: string): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  // Match tokens of alphanumeric + common secret chars, minimum length
  const tokenPattern = /[a-zA-Z0-9_\-/.+]{16,}/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    const token = match[0];
    if (token.length < MIN_TOKEN_LENGTH) continue;

    const entropy = shannonEntropy(token);
    if (entropy > ENTROPY_THRESHOLD && isNearContextWord(text, match.index, match.index + token.length)) {
      matches.push({ start: match.index, end: match.index + token.length });
    }
  }

  return matches;
}

/**
 * Apply redaction to a string, replacing matched ranges with [REDACTED].
 * Handles overlapping ranges by merging them.
 */
function applyRedactions(
  text: string,
  ranges: Array<{ start: number; end: number }>,
): string {
  if (ranges.length === 0) return text;

  // Sort by start, then merge overlapping ranges
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  // Apply from end to start to preserve indices
  let result = text;
  for (let i = merged.length - 1; i >= 0; i--) {
    const range = merged[i]!;
    result = result.slice(0, range.start) + REDACTED + result.slice(range.end);
  }
  return result;
}

/**
 * Sanitize a string value using both Layer 1 (regex) and Layer 2 (entropy).
 * Returns the sanitized string.
 */
export function sanitizeString(input: string): string {
  const ranges: Array<{ start: number; end: number }> = [];

  // Layer 1: Known patterns
  for (const { pattern } of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global regexes
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(input)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Layer 2: Entropy-based
  const entropyMatches = findEntropyMatches(input);
  ranges.push(...entropyMatches);

  return applyRedactions(input, ranges);
}

/**
 * Deep-clone and sanitize all string values in a record.
 * Returns a new object — never mutates the input.
 */
export function sanitizeDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(details), (_key, value) => {
    if (typeof value === "string") {
      return sanitizeString(value);
    }
    return value;
  }) as Record<string, unknown>;
}

/**
 * Sanitize an AuditEvent's details field.
 * Returns a new AuditEvent with sanitized details — input is untouched.
 */
export function sanitizeEvent<T extends { details: Record<string, unknown> }>(
  event: T,
): T {
  return {
    ...event,
    details: sanitizeDetails(event.details),
  };
}

export { shannonEntropy, CREDENTIAL_PATTERNS, CONTEXT_WORDS, ENTROPY_THRESHOLD };
