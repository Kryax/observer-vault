/**
 * S0 — PRD Reader
 *
 * Reads .prd/ markdown files and returns typed PRD objects.
 * Regex-only parsing — no external dependencies.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PRD, PRDStatus, PRDLogEntry, PRDContext } from "./prd.ts";
import type {
  ISC,
  ISCStatus,
  VerificationMethod,
  ConfidenceTag,
  ISCPriority,
} from "./isc.ts";

const VALID_STATUSES: Set<string> = new Set([
  "DRAFT",
  "CRITERIA_DEFINED",
  "PLANNED",
  "IN_PROGRESS",
  "VERIFYING",
  "COMPLETE",
  "FAILED",
  "BLOCKED",
]);

const VALID_METHODS: Set<string> = new Set([
  "CLI",
  "Test",
  "Static",
  "Browser",
  "Grep",
  "Read",
  "Custom",
]);

const VALID_CONFIDENCE: Set<string> = new Set(["E", "I", "R"]);
const VALID_PRIORITY: Set<string> = new Set(["CRITICAL", "IMPORTANT", "NICE"]);

function parseFrontmatter(
  raw: string
): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kv) {
      result[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return result;
}

function parseStatus(val: string | undefined): PRDStatus {
  if (val && VALID_STATUSES.has(val)) return val as PRDStatus;
  return "DRAFT";
}

function extractSection(raw: string, heading: string): string {
  // Find the heading line, then capture everything until the next ## heading or end of string.
  // We avoid multiline $ which causes lazy quantifier to match empty string.
  const headingPattern = new RegExp(
    `^##\\s+${heading}\\b[^\\n]*`,
    "mi"
  );
  const hm = headingPattern.exec(raw);
  if (!hm) return "";
  const start = hm.index + hm[0].length;
  // Find next ## heading (but not ###)
  const rest = raw.slice(start);
  const nextH2 = rest.search(/\n##\s(?!#)/);
  const body = nextH2 === -1 ? rest : rest.slice(0, nextH2);
  return body.trim();
}

function extractSubSection(section: string, heading: string): string {
  const headingPattern = new RegExp(
    `^###\\s+${heading}\\b[^\\n]*`,
    "mi"
  );
  const hm = headingPattern.exec(section);
  if (!hm) return "";
  const start = hm.index + hm[0].length;
  const rest = section.slice(start);
  const nextH3 = rest.search(/\n###\s/);
  const body = nextH3 === -1 ? rest : rest.slice(0, nextH3);
  return body.trim();
}

function parseISCCriteria(raw: string): ISC[] {
  const results: ISC[] = [];
  // Match lines like: - [ ] **ISC-C1:** description | Verify: Test: `command`
  // or: - [x] **ISC-C1:** description | Verify: CLI: `command`
  // Also handle without bold markers
  const linePattern =
    /^[-*]\s+\[([ xX])\]\s+\*{0,2}(ISC-[\w-]+):?\*{0,2}\s*(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = linePattern.exec(raw)) !== null) {
    const checked = m[1].trim().toLowerCase() === "x";
    const id = m[2];
    let rest = m[3];

    // Extract verification from pipe suffix
    let verificationMethod: VerificationMethod = "Custom";
    let verificationCommand = "";
    const pipeIdx = rest.lastIndexOf("|");
    if (pipeIdx !== -1) {
      const suffix = rest.slice(pipeIdx + 1).trim();
      rest = rest.slice(0, pipeIdx).trim();
      // Match "Verify: METHOD: command" or "METHOD: command"
      const verifyMatch = suffix.match(
        /(?:Verify\s*:\s*)?(\w+)\s*:\s*[`"]?([^`"]*)[`"]?/
      );
      if (verifyMatch) {
        const method = verifyMatch[1];
        if (VALID_METHODS.has(method)) {
          verificationMethod = method as VerificationMethod;
        }
        verificationCommand = verifyMatch[2].trim();
      }
    }

    // Extract confidence tag and priority if present in brackets
    let confidenceTag: ConfidenceTag = "E";
    let priority: ISCPriority = "IMPORTANT";
    const tagMatch = rest.match(/\[([EIR])\]/);
    if (tagMatch && VALID_CONFIDENCE.has(tagMatch[1])) {
      confidenceTag = tagMatch[1] as ConfidenceTag;
    }
    const priMatch = rest.match(/\b(CRITICAL|IMPORTANT|NICE)\b/);
    if (priMatch && VALID_PRIORITY.has(priMatch[1])) {
      priority = priMatch[1] as ISCPriority;
    }

    // Clean description: remove trailing pipe artifacts, tags
    let description = rest
      .replace(/\[([EIR])\]/, "")
      .replace(/\b(CRITICAL|IMPORTANT|NICE)\b/, "")
      .replace(/\s+/g, " ")
      .trim();
    // Remove leading colon or dash if present
    description = description.replace(/^[:\-]\s*/, "").trim();

    const status: ISCStatus = checked ? "passing" : "pending";

    results.push({
      id,
      description,
      status,
      verificationMethod,
      verificationCommand,
      confidenceTag,
      priority,
    });
  }
  return results;
}

function parseLogEntries(raw: string): PRDLogEntry[] {
  const logSection = extractSection(raw, "LOG");
  if (!logSection) return [];

  const entries: PRDLogEntry[] = [];
  // Split on iteration headers
  const iterBlocks = logSection.split(/(?=###\s+Iteration\b)/);
  for (const block of iterBlocks) {
    const headerMatch = block.match(
      /###\s+Iteration\s+(\d+)\s*(?:[-—]\s*(\S+))?/
    );
    if (!headerMatch) continue;

    const iteration = parseInt(headerMatch[1], 10);
    const date = headerMatch[2] || "";

    const getField = (name: string): string => {
      const pat = new RegExp(
        `\\*{0,2}${name}\\*{0,2}\\s*:\\s*(.*)`,
        "i"
      );
      const fieldMatch = block.match(pat);
      return fieldMatch ? fieldMatch[1].trim() : "";
    };

    const failingRaw = getField("Failing Criteria") || getField("Failing");
    const failingCriteria = failingRaw
      ? failingRaw
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    entries.push({
      iteration,
      date,
      phaseReached: getField("Phase Reached") || getField("Phase"),
      criteriaProgress:
        getField("Criteria Progress") || getField("Progress"),
      workDone: getField("Work Done") || getField("Work"),
      failingCriteria,
      contextForNext:
        getField("Context for Next") || getField("Context"),
    });
  }
  return entries;
}

function parseContext(raw: string): PRDContext {
  const contextSection = extractSection(raw, "CONTEXT");
  if (!contextSection) {
    return {
      problemSpace: "",
      keyFiles: {},
      constraints: [],
      decisionsMade: [],
    };
  }

  const problemSpace = extractSubSection(contextSection, "Problem Space");

  // Parse Key Files table
  const keyFiles: Record<string, string> = {};
  const keyFilesSection = extractSubSection(contextSection, "Key Files");
  if (keyFilesSection) {
    const rowPattern = /^\|\s*`?([^|`]+)`?\s*\|\s*([^|]+)\s*\|/gm;
    let rm: RegExpExecArray | null;
    while ((rm = rowPattern.exec(keyFilesSection)) !== null) {
      const key = rm[1].trim();
      const val = rm[2].trim();
      // Skip header/separator rows
      if (key === "File" || key.startsWith("-")) continue;
      keyFiles[key] = val;
    }
  }

  // Parse Constraints as bullet list
  const constraintsSection = extractSubSection(contextSection, "Constraints");
  const constraints = constraintsSection
    ? constraintsSection
        .split("\n")
        .filter((l) => /^[-*]\s+/.test(l))
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
    : [];

  // Parse Decisions Made as bullet list
  const decisionsSection = extractSubSection(
    contextSection,
    "Decisions Made"
  );
  const decisionsMade = decisionsSection
    ? decisionsSection
        .split("\n")
        .filter((l) => /^[-*]\s+/.test(l))
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
    : [];

  return { problemSpace, keyFiles, constraints, decisionsMade };
}

export function readPRD(filePath: string): PRD {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    // File unreadable — return empty PRD with defaults
    return {
      id: "",
      status: "DRAFT",
      effortLevel: "",
      created: "",
      updated: "",
      iteration: 0,
      slices: [],
      iscCriteria: [],
      context: {
        problemSpace: "",
        keyFiles: {},
        constraints: [],
        decisionsMade: [],
      },
      plan: "",
      log: [],
    };
  }

  const fm = parseFrontmatter(raw);

  const planSection = extractSection(raw, "PLAN");

  return {
    id: fm.id || "",
    status: parseStatus(fm.status),
    effortLevel: fm.effort_level || fm.effortLevel || "",
    created: fm.created || "",
    updated: fm.updated || "",
    iteration: parseInt(fm.iteration || "0", 10) || 0,
    slices: [],
    iscCriteria: parseISCCriteria(raw),
    context: parseContext(raw),
    plan: planSection,
    log: parseLogEntries(raw),
  };
}

export function listPRDs(dir: string): PRD[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const prds: PRD[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    try {
      prds.push(readPRD(join(dir, entry)));
    } catch {
      // Skip unparseable files
    }
  }

  // Sort by updated date descending
  prds.sort((a, b) => {
    if (!a.updated && !b.updated) return 0;
    if (!a.updated) return 1;
    if (!b.updated) return -1;
    return b.updated.localeCompare(a.updated);
  });

  return prds;
}
