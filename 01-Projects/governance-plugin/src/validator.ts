/**
 * Observer Governance Plugin — Frontmatter Validator
 * Pure validation logic. No Obsidian API. No external dependencies.
 * Checks frontmatter against SCHEMA controlled vocabulary.
 */

import { SCHEMA } from './schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  field: string;
  message: string;
  expected?: string;
  actual?: any;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** All field names the schema knows about (required + optional + enum-only). */
const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  ...SCHEMA.required,
  ...SCHEMA.optional_fields,
]);

/** Enum field names that have a controlled vocabulary list in the schema. */
const ENUM_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(SCHEMA.enums),
);

function hasEnum(field: string): field is keyof typeof SCHEMA.enums {
  return ENUM_FIELDS.has(field);
}

/**
 * Validate a single enum value against its allowed list.
 * Returns an error issue if the value is not in the allowed set, else null.
 */
function checkEnumValue(
  field: string,
  value: unknown,
  allowed: readonly string[],
): ValidationIssue | null {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return null;
  }
  return {
    field,
    message: `Invalid value for '${field}'. Expected one of: ${allowed.join(', ')}`,
    expected: allowed.join(', '),
    actual: value,
  };
}

/**
 * Validate an array-typed enum field (like `domain`).
 * Each element must be a valid enum value and the array must respect max length.
 */
function checkEnumArray(
  field: string,
  value: unknown,
  allowed: readonly string[],
  max: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(value)) {
    issues.push({
      field,
      message: `'${field}' must be an array`,
      expected: 'array',
      actual: typeof value,
    });
    return issues;
  }

  if (value.length > max) {
    issues.push({
      field,
      message: `'${field}' has ${value.length} entries but maximum is ${max}`,
      expected: `<= ${max} entries`,
      actual: value.length,
    });
  }

  for (const item of value) {
    if (typeof item !== 'string' || !(allowed as readonly string[]).includes(item)) {
      issues.push({
        field,
        message: `Invalid value '${String(item)}' in '${field}'. Expected one of: ${allowed.join(', ')}`,
        expected: allowed.join(', '),
        actual: item,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a frontmatter record against the Observer governance schema.
 *
 * Design choices:
 *  - Fail-open: validation is advisory, never blocks saves.
 *  - Missing required fields -> errors.
 *  - Invalid enum values    -> errors.
 *  - domain array > 3       -> errors.
 *  - meta_version non-numeric -> error.
 *  - Fields prefixed x_     -> silently skipped (extension namespace).
 *  - Unknown fields          -> warnings (not errors).
 *  - Missing optional fields -> not flagged at all.
 */
export function validateFrontmatter(
  frontmatter: Record<string, any>,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ------------------------------------------------------------------
  // 1. Required field presence
  // ------------------------------------------------------------------
  for (const field of SCHEMA.required) {
    if (!(field in frontmatter) || frontmatter[field] === undefined || frontmatter[field] === null) {
      errors.push({
        field,
        message: `Missing required field '${field}'`,
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. meta_version must be numeric
  // ------------------------------------------------------------------
  if ('meta_version' in frontmatter && frontmatter.meta_version != null) {
    const mv = frontmatter.meta_version;
    if (typeof mv !== 'number' || Number.isNaN(mv)) {
      errors.push({
        field: 'meta_version',
        message: `'meta_version' must be numeric`,
        expected: 'number',
        actual: mv,
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. Enum validation for scalar fields (kind, status, authority, source,
  //    confidence, mode, promoted_by)
  // ------------------------------------------------------------------
  for (const field of Object.keys(SCHEMA.enums) as (keyof typeof SCHEMA.enums)[]) {
    if (!(field in frontmatter) || frontmatter[field] == null) {
      continue; // missing fields handled above (required) or ignored (optional)
    }

    const value = frontmatter[field];
    const allowed = SCHEMA.enums[field];

    // domain is the only array-typed enum field
    if (field === 'domain') {
      const arrayIssues = checkEnumArray(field, value, allowed, SCHEMA.domain_max);
      errors.push(...arrayIssues);
    } else {
      const issue = checkEnumValue(field, value, allowed);
      if (issue) {
        errors.push(issue);
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. Unknown fields -> warnings (skip x_ prefixed)
  // ------------------------------------------------------------------
  for (const field of Object.keys(frontmatter)) {
    // Extension namespace: silently skip
    if (field.startsWith('x_')) {
      continue;
    }

    // Known field: no warning
    if (KNOWN_FIELDS.has(field)) {
      continue;
    }

    // Enum-keyed fields are also known
    if (ENUM_FIELDS.has(field)) {
      continue;
    }

    warnings.push({
      field,
      message: `Unknown field '${field}' is not in the schema`,
      actual: frontmatter[field],
    });
  }

  return { errors, warnings };
}
