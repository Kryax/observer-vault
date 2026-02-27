// S6: Environment sanitization, argument validation, and output redaction
// This is the #1 security guarantee of the dispatch layer.
// sanitizedEnv() is sacred — child processes NEVER receive process.env.

/**
 * Allowlist of environment variable names that may be passed to child processes.
 * Everything else is stripped. This is the ONLY way env vars reach backends.
 */
const ALLOWED_ENV_EXACT: ReadonlySet<string> = new Set([
  "PATH",
  "HOME",
  "TERM",
  "LANG",
  "USER",
]);

/**
 * Prefixes for allowed env vars (e.g., XDG_*).
 */
const ALLOWED_ENV_PREFIXES: readonly string[] = ["XDG_"];

/**
 * Suffixes that indicate credential env vars — ALWAYS blocked even if
 * they somehow match an allowed prefix.
 */
const CREDENTIAL_SUFFIXES: readonly string[] = [
  "_KEY",
  "_TOKEN",
  "_SECRET",
  "_PASSWORD",
  "_CREDENTIAL",
  "_API_KEY",
];

/**
 * Credential patterns for argument validation and output redaction.
 * Each pattern matches a known credential format.
 */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  // OpenAI API keys
  /sk-[a-zA-Z0-9]{20,}/g,
  // Google API keys
  /AIza[a-zA-Z0-9_-]{35}/g,
  // GitHub personal access tokens
  /ghp_[a-zA-Z0-9]{36}/g,
  // GitHub OAuth tokens
  /gho_[a-zA-Z0-9]{36}/g,
  // GitHub user-to-server tokens
  /ghu_[a-zA-Z0-9]{36}/g,
  // GitHub server-to-server tokens
  /ghs_[a-zA-Z0-9]{36}/g,
  // GitHub refresh tokens
  /ghr_[a-zA-Z0-9]{36}/g,
  // AWS access key IDs
  /AKIA[0-9A-Z]{16}/g,
  // Slack tokens
  /xox[bpors]-[0-9a-zA-Z-]{10,}/g,
  // Generic bearer tokens (long hex or base64 strings that look like tokens)
  /(?:bearer|token|authorization)[:\s]+[a-zA-Z0-9_\-.]{20,}/gi,
];

/**
 * ANSI escape sequence pattern for stripping terminal color codes.
 */
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Default maximum output size in bytes (10 MB).
 */
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

/**
 * Build a sanitized environment object from process.env.
 * Returns a NEW object containing ONLY allowed variables.
 *
 * SECURITY INVARIANT: This function NEVER copies process.env wholesale.
 * It builds a fresh object by iterating the allowlist against process.env.
 * Credential-bearing vars (*_KEY, *_TOKEN, *_SECRET, etc.) are ALWAYS excluded.
 *
 * @param extraVars Optional record of additional env vars to include
 *                  (e.g., backend-specific configuration). These are also
 *                  screened for credential suffixes.
 * @returns A new environment object safe for child process spawning
 */
export function sanitizedEnv(
  extraVars?: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};

  // Copy only allowed vars from process.env
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (isCredentialVar(key)) continue;

    if (ALLOWED_ENV_EXACT.has(key)) {
      env[key] = value;
      continue;
    }

    for (const prefix of ALLOWED_ENV_PREFIXES) {
      if (key.startsWith(prefix)) {
        env[key] = value;
        break;
      }
    }
  }

  // Merge extra vars, but still block credential-named ones
  if (extraVars) {
    for (const [key, value] of Object.entries(extraVars)) {
      if (isCredentialVar(key)) continue;
      env[key] = value;
    }
  }

  return env;
}

/**
 * Check if an env var name looks like a credential.
 */
function isCredentialVar(name: string): boolean {
  const upper = name.toUpperCase();
  return CREDENTIAL_SUFFIXES.some((suffix) => upper.endsWith(suffix));
}

/**
 * Calculate Shannon entropy of a string.
 * Used to detect high-entropy strings that are likely credentials or tokens.
 *
 * @param str The string to analyze
 * @returns Shannon entropy in bits per character
 */
export function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Validate command-line arguments for credential leaks.
 * Throws an Error if any argument contains a known credential pattern
 * or looks like a high-entropy secret.
 *
 * @param args Array of command-line arguments to validate
 * @throws Error with descriptive message if a credential is detected
 */
export function validateArgs(args: readonly string[]): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check known credential patterns
    for (const pattern of CREDENTIAL_PATTERNS) {
      // Reset lastIndex since patterns use /g flag
      pattern.lastIndex = 0;
      if (pattern.test(arg)) {
        throw new Error(
          `Argument at index ${i} contains a credential pattern. ` +
            `Credentials must never be passed as command arguments.`,
        );
      }
    }

    // Check high-entropy strings (likely tokens/keys)
    if (arg.length > 20 && shannonEntropy(arg) > 4.5) {
      throw new Error(
        `Argument at index ${i} has high entropy (${shannonEntropy(arg).toFixed(2)} bits) ` +
          `and is longer than 20 chars. This looks like a credential or token.`,
      );
    }
  }
}

/**
 * Sanitize process output by redacting credentials and stripping ANSI codes.
 *
 * @param output Raw stdout/stderr from a child process
 * @param maxBytes Maximum output size in bytes (default 10 MB). Output is
 *                 truncated from the end if it exceeds this limit.
 * @returns Object with sanitized text and whether it was truncated
 */
export function sanitizeOutput(
  output: string,
  maxBytes: number = DEFAULT_MAX_OUTPUT_BYTES,
): { text: string; truncated: boolean } {
  let text = output;

  // Strip ANSI escape sequences
  text = text.replace(ANSI_PATTERN, "");

  // Redact known credential patterns
  for (const pattern of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[REDACTED]");
  }

  // Truncate if necessary (byte-length check)
  const byteLength = Buffer.byteLength(text, "utf-8");
  let truncated = false;
  if (byteLength > maxBytes) {
    // Truncate to approximate char count (may be slightly over for multi-byte)
    // Use a safe estimate: truncate at maxBytes chars then re-check
    const truncatedBuf = Buffer.from(text, "utf-8").subarray(0, maxBytes);
    text = truncatedBuf.toString("utf-8");
    truncated = true;
  }

  return { text, truncated };
}

// Re-export constants for testing
export const _testing = {
  ALLOWED_ENV_EXACT,
  ALLOWED_ENV_PREFIXES,
  CREDENTIAL_SUFFIXES,
  CREDENTIAL_PATTERNS,
  ANSI_PATTERN,
  DEFAULT_MAX_OUTPUT_BYTES,
  isCredentialVar,
} as const;
