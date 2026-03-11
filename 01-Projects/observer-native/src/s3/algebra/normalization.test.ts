import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  normalizeCandidateNote,
  normalizeLibraryMotifMarkdown,
} from "./normalization.ts";

const ROOT = "/mnt/zfs-host/backup/projects/observer-vault";
const MOTIFS_DIR = join(ROOT, "02-Knowledge/motifs");

describe("algebra normalization adapters", () => {
  test("normalizes an existing library motif markdown file", () => {
    const filePath = join(MOTIFS_DIR, "reflexive-structural-transition.md");
    const markdown = readFileSync(filePath, "utf8");
    const result = normalizeLibraryMotifMarkdown(markdown, { filePath });

    expect(result.record.id).toBe("motif:reflexive-structural-transition");
    expect(result.record.name).toBe("Reflexive Structural Transition");
    expect(result.record.tier).toBe(0);
    expect(result.record.sourceType).toBe("bottom-up");
    expect(result.record.derivativeOrder).toBe(2);
    expect(result.record.axisVector).toEqual({
      differentiate: 0,
      integrate: 0,
      recurse: 1,
    });
    expect(result.record.instances.length).toBe(7);
    expect(result.record.relationships.length).toBe(4);
    expect(result.record.instances[0]?.domain).toBe("Software Architecture / Fault Tolerance");
    expect(result.warnings).toContain(
      "Axis vector synthesized from `primary_axis`; markdown schema does not provide explicit weights.",
    );
  });

  test("normalizes codex raw candidates into candidate records", () => {
    const filePath = join(MOTIFS_DIR, "codex-dir-metamorphosis-language-20260311.md");
    const markdown = readFileSync(filePath, "utf8");
    const candidates = normalizeCandidateNote(markdown, { filePath });

    expect(candidates).toHaveLength(3);

    const constraintField = candidates[0];
    expect(constraintField?.id).toBe("candidate:constraint-field-reorganization");
    expect(constraintField?.name).toBe("Constraint-Field Reorganization");
    expect(constraintField?.tier).toBe(0);
    expect(constraintField?.sourceType).toBe("session-derived");
    expect(constraintField?.instances).toHaveLength(2);
    expect(constraintField?.instances[0]?.domain).toBe("biological-metamorphosis");
    expect(constraintField?.instances[1]?.domain).toBe("language-evolution");
    expect(constraintField?.invariants).toContain(
      "some old configurations become unreachable while new ones become possible",
    );
    expect(constraintField?.comparisonReport.strongestMatch).toBeNull();
    expect(constraintField?.normalizationWarnings).toContain(
      "Candidate sourceType normalized to `session-derived` from raw note context.",
    );
  });

  test("emits warnings when library schema drifts", () => {
    const markdown = `---
name: "Drifted Motif"
tier: high
confidence: 1.5
source: codex
derivative_order:
primary_axis: sideways
---

# Drifted Motif

## Instances

### Instance 1: Example
- **Expression:** Something happened.
`;

    const result = normalizeLibraryMotifMarkdown(markdown, {
      filePath: "02-Knowledge/motifs/drifted-motif.md",
    });

    expect(result.record.tier).toBe(0);
    expect(result.record.confidence).toBe(0);
    expect(result.record.sourceType).toBe("session-derived");
    expect(result.record.axisVector).toEqual({
      differentiate: 1 / 3,
      integrate: 1 / 3,
      recurse: 1 / 3,
    });
    expect(result.warnings).toContain("Invalid tier value `high`; using 0.");
    expect(result.warnings).toContain("Invalid confidence value `1.5`; using 0.");
    expect(result.warnings).toContain("Missing `derivative_order`; using 0.");
    expect(result.warnings).toContain("Invalid `primary_axis` value `sideways`.");
    expect(result.warnings).toContain("Invalid frontmatter `source` value `codex`; using `session-derived`.");
  });
});
