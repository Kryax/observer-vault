import { readFileSync } from "node:fs";
import { join } from "node:path";

import { VAULT_ROOT } from "../../s2/vault-writer.ts";
import type { CandidateEvaluation } from "./engine.ts";
import { evaluateCandidateNote } from "./engine.ts";

export const CODEX_REGRESSION_NOTE_PATH =
  "02-Knowledge/motifs/codex-dir-metamorphosis-language-20260311.md";

export function loadCodexRegressionNote(): string {
  return readFileSync(join(VAULT_ROOT, CODEX_REGRESSION_NOTE_PATH), "utf8");
}

export function evaluateCodexRegression(): CandidateEvaluation[] {
  return evaluateCandidateNote(loadCodexRegressionNote(), {
    filePath: CODEX_REGRESSION_NOTE_PATH,
  });
}
