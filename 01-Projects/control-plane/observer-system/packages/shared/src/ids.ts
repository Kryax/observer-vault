// S0: ID generation with prefixed nanoid
// Custom alphabet: 0-9 a-z (36 characters, lowercase only)

import { customAlphabet } from "nanoid";
import { ID_PREFIXES, ID_LENGTHS } from "./types.js";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

type EntityType = keyof typeof ID_PREFIXES;

/**
 * Generate a prefixed ID for the given entity type.
 * Uses nanoid with custom lowercase alphanumeric alphabet.
 *
 * @example
 *   generateId("session") // "ses_a1b2c3d4e5f6"
 *   generateId("audit_event") // "evt_a1b2c3d4e5f6g7h8" (16 chars)
 */
export function generateId(entityType: EntityType): string {
  const prefix = ID_PREFIXES[entityType];
  const length = ID_LENGTHS[entityType];
  const generate = customAlphabet(ALPHABET, length);
  return `${prefix}${generate()}`;
}

export { ALPHABET };
