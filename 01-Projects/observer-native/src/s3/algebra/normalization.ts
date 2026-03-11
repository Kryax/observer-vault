import type { MotifAxis } from "../../s0/index.ts";

import {
  ALGEBRA_OPERATORS,
  type AlgebraOperator,
  type AxisVector,
  type CandidateRecord,
  type ComparisonReport,
  type InstanceRecord,
  type MotifRecord,
  type MotifRelationshipRecord,
  type MotifSourceType,
  type MotifTier,
} from "./types.ts";

export interface NormalizationResult<T> {
  record: T;
  warnings: string[];
}

interface ParsedFrontmatter {
  body: string;
  fields: Record<string, string | string[]>;
}

interface CandidateSection {
  name: string;
  definition: string | null;
  invariants: string[];
  falsification: string | null;
}

interface DomainSection {
  heading: string;
  domain: string;
  bullets: string[];
}

const DEFAULT_COMPARISON_REPORT: ComparisonReport = {
  comparedAgainst: [],
  strongestMatch: null,
  derivationConflict: false,
  reviewRequired: false,
  notes: ["Normalization only; comparison has not been computed yet."],
};

const AXIS_ORDER: MotifAxis[] = ["differentiate", "integrate", "recurse"];

const RELATIONSHIP_KINDS = new Set<MotifRelationshipRecord["kind"]>([
  "complement",
  "tension",
  "composition",
  "possible_derivation",
  "overlap",
]);

const SOURCE_TYPES = new Set<MotifSourceType>([
  "top-down",
  "bottom-up",
  "triangulated",
  "session-derived",
]);

const OPERATOR_KEYWORDS: Array<[AlgebraOperator, RegExp]> = [
  ["rewrite", /\brewrite|rewrit|grammar|reorgani[sz]e|reconfigur/i],
  ["align", /\balign|alignment|interoperab|shared latent|normalize/i],
  ["compress", /\bcompress|compression|collapse distinctions|merge|regulari[sz]/i],
  ["dissolve", /\bdissolv|shed|break down|histolysis|degrad/i],
  ["scaffold", /\bscaffold|intermediate|temporary support|transitional/i],
  ["reconstitute", /\breconstitut|recompos|rebuild|consolidat/i],
  ["branch", /\bbranch|pathway|reachable futures|transition pathways|canaliz/i],
  ["gate", /\bgate|threshold|guard|constrain/i],
  ["buffer", /\bbuffer|overflow|queue|toleran/i],
  ["converge", /\bconverg|stabiliz|settle|cohere/i],
];

export function normalizeLibraryMotifMarkdown(
  markdown: string,
  options: { filePath?: string } = {},
): NormalizationResult<MotifRecord> {
  const warnings: string[] = [];
  const { body, fields } = parseFrontmatter(markdown);
  const filePath = options.filePath;

  const headingName = matchHeading(body);
  const name = readStringField(fields, "name") ?? headingName ?? "Unnamed Motif";

  if (!readStringField(fields, "name")) {
    warnings.push("Missing frontmatter field `name`; using H1 heading.");
  }

  if (headingName && readStringField(fields, "name") && headingName !== name) {
    warnings.push("Frontmatter `name` does not match the H1 heading.");
  }

  const tier = parseTier(fields.tier, warnings, "tier");
  const confidence = parseConfidence(fields.confidence, warnings, "confidence");
  const derivativeOrder = parseDerivativeOrder(fields.derivative_order, warnings);

  const primaryAxis = parsePrimaryAxis(fields.primary_axis, warnings);
  const axisVector = synthesizeAxisVector(primaryAxis, warnings);

  const structuralDescription = extractSection(body, "Structural Description") ?? "";
  const domainIndependent = extractSection(body, "Domain-Independent Formulation") ?? "";
  const falsificationSection = extractSection(body, "Falsification Conditions") ?? "";

  if (!structuralDescription) {
    warnings.push("Missing `## Structural Description` section.");
  }

  if (!domainIndependent) {
    warnings.push("Missing `## Domain-Independent Formulation` section.");
  }

  if (!falsificationSection) {
    warnings.push("Missing `## Falsification Conditions` section.");
  }

  const invariants = deriveMotifInvariants(structuralDescription, domainIndependent, warnings);
  const falsifiers = parseBulletList(falsificationSection);

  if (falsifiers.length === 0) {
    warnings.push("No falsification bullets found; using first sentence fallback if available.");
    const fallback = firstSentence(falsificationSection);
    if (fallback) {
      falsifiers.push(fallback);
    }
  }

  const instanceSection = extractSection(body, "Instances") ?? "";
  const instances = parseLibraryInstances({
    filePath,
    motifName: name,
    motifInvariants: invariants,
    motifFalsifiers: falsifiers,
    motifAxis: primaryAxis,
    motifSourceField: fields.source,
    instanceSection,
    structuralDescription,
    warnings,
  });

  if (instances.length === 0) {
    warnings.push("No instances parsed from `## Instances` section.");
  }

  const relationships = parseRelationships(
    extractSection(body, "Relationships") ?? "",
    warnings,
  );

  const sourceType = normalizeSourceType(
    fields.source,
    warnings,
    "frontmatter `source`",
    inferMotifSourceFromInstances(instances),
  );

  return {
    record: {
      id: `motif:${slugify(name)}`,
      name,
      tier,
      axisVector,
      derivativeOrder,
      sourceType,
      confidence,
      instances,
      invariants,
      falsifiers,
      relationships,
    },
    warnings,
  };
}

export function normalizeCandidateNote(
  markdown: string,
  options: { filePath?: string } = {},
): CandidateRecord[] {
  const { body, fields } = parseFrontmatter(markdown);
  const filePath = options.filePath;
  const noteWarnings: string[] = [];
  const tier = parseTier(fields.tier, noteWarnings, "tier");
  const confidence = parseConfidence(fields.confidence, noteWarnings, "confidence");
  const derivativeOrder = parseDerivativeOrder(fields.derivative_order, noteWarnings);
  const primaryAxis = parsePrimaryAxis(fields.primary_axis, noteWarnings);
  const domainSections = parseDomainSections(body, readArrayField(fields, "domains"));
  const candidates = parseCandidateSections(extractSection(body, "R - Motif Candidates") ?? "");

  return candidates.map((candidate) => {
    const warnings = [...noteWarnings];
    const axisVector = synthesizeAxisVector(primaryAxis, warnings);
    const instances = domainSections.map((domainSection, index) => {
      const operatorTags = inferOperatorTags(
        [
          candidate.name,
          candidate.definition ?? "",
          candidate.invariants.join(" "),
          candidate.falsification ?? "",
          domainSection.bullets.join(" "),
        ].join("\n"),
      );

      return {
        id: `instance:${slugify(candidate.name)}:${slugify(domainSection.domain || String(index + 1))}`,
        domain: domainSection.domain,
        sourceType: "bottom-up",
        evidenceRefs: [
          {
            filePath,
            section: domainSection.heading,
            excerpt: domainSection.bullets[0],
            note: `Derived from raw candidate note for ${candidate.name}.`,
          },
        ],
        operatorTags,
        structuralClaims: compact([
          candidate.definition,
          ...domainSection.bullets.slice(0, 2),
        ]),
        invariants:
          candidate.invariants.length > 0
            ? candidate.invariants
            : compact([candidate.definition]),
        falsifiers: compact([candidate.falsification]),
        primaryAxis: primaryAxis ?? undefined,
      } satisfies InstanceRecord;
    });

    if (instances.length === 0) {
      warnings.push("No `## D - ...` domain sections were available; candidate has no instances.");
    }

    if (!candidate.definition) {
      warnings.push(`Candidate \`${candidate.name}\` is missing a definition bullet.`);
    }

    if (candidate.invariants.length === 0) {
      warnings.push(`Candidate \`${candidate.name}\` is missing invariant bullets.`);
    }

    if (!candidate.falsification) {
      warnings.push(`Candidate \`${candidate.name}\` is missing a falsification bullet.`);
    }

    warnings.push("Candidate sourceType normalized to `session-derived` from raw note context.");

    return {
      id: `candidate:${slugify(candidate.name)}`,
      name: candidate.name,
      tier,
      axisVector,
      derivativeOrder,
      sourceType: "session-derived",
      confidence,
      instances,
      invariants:
        candidate.invariants.length > 0
          ? candidate.invariants
          : compact([candidate.definition]),
      falsifiers: compact([candidate.falsification]),
      relationships: [],
      comparisonReport: DEFAULT_COMPARISON_REPORT,
      normalizationWarnings: warnings,
    } satisfies CandidateRecord;
  });
}

function parseLibraryInstances(args: {
  filePath?: string;
  motifName: string;
  motifInvariants: string[];
  motifFalsifiers: string[];
  motifAxis: MotifAxis | null;
  motifSourceField: string | string[] | undefined;
  instanceSection: string;
  structuralDescription: string;
  warnings: string[];
}): InstanceRecord[] {
  const blocks = splitThirdLevelSections(args.instanceSection);

  return blocks.map((block, index) => {
    const fields = parseBoldLabelBullets(block.content);
    const domain = fields.Domain ?? block.title.replace(/^Instance\s+\d+:\s*/i, "").trim();
    const expression = fields.Expression ?? firstSentence(block.content) ?? block.title;
    const discoveryDate = fields["Discovery date"];
    const sourceType = normalizeSourceType(
      fields.Source ?? args.motifSourceField,
      args.warnings,
      `instance \`${block.title}\` source`,
      inferSourceTypeFromText(fields.Source) ?? inferSourceTypeFromUnknown(args.motifSourceField) ?? "session-derived",
    );
    const operatorTags = inferOperatorTags(
      [block.title, expression, args.structuralDescription].join("\n"),
    );

    if (!fields.Expression) {
      args.warnings.push(`Instance \`${block.title}\` is missing an Expression bullet; using fallback text.`);
    }

    if (!fields.Domain) {
      args.warnings.push(`Instance \`${block.title}\` is missing a Domain bullet; using heading text.`);
    }

    return {
      id: `instance:${slugify(args.motifName)}:${slugify(domain || String(index + 1))}`,
      domain: domain || `instance-${index + 1}`,
      sourceType,
      evidenceRefs: [
        {
          filePath: args.filePath,
          section: block.title,
          excerpt: expression,
          note: discoveryDate ? `Discovery date: ${discoveryDate}` : undefined,
        },
      ],
      operatorTags,
      structuralClaims: [expression],
      invariants: args.motifInvariants,
      falsifiers: args.motifFalsifiers,
      primaryAxis: args.motifAxis ?? undefined,
    } satisfies InstanceRecord;
  });
}

function parseRelationships(
  section: string,
  warnings: string[],
): MotifRelationshipRecord[] {
  const rows = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (rows.length < 3) {
    return [];
  }

  const relationships: MotifRelationshipRecord[] = [];

  for (const row of rows.slice(2)) {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length < 3) {
      continue;
    }

    const [targetMotif, relationship, note] = cells;

    if (!RELATIONSHIP_KINDS.has(relationship as MotifRelationshipRecord["kind"])) {
      warnings.push(`Unknown relationship kind \`${relationship}\`; row skipped.`);
      continue;
    }

    relationships.push({
      kind: relationship as MotifRelationshipRecord["kind"],
      targetMotif,
      note,
    });
  }

  return relationships;
}

function parseCandidateSections(section: string): CandidateSection[] {
  return splitThirdLevelSections(section).map((block) => {
    const definition = matchLabeledBullet(block.content, "Definition");
    const falsification = matchLabeledBullet(block.content, "Falsification");
    const invariantsMatch = block.content.match(/-\s+Invariants:\s*\n([\s\S]*?)(?=\n-\s+[A-Z]|$)/);

    return {
      name: block.title.replace(/^Motif\s+\d+:\s*/i, "").trim(),
      definition,
      invariants: invariantsMatch ? parseIndentedBullets(invariantsMatch[1]) : [],
      falsification,
    };
  });
}

function parseDomainSections(
  body: string,
  declaredDomains: string[],
): DomainSection[] {
  const sections = splitSecondLevelSections(body);
  const domainsBySlug = new Map(
    declaredDomains.map((domain) => [slugify(domain), domain] as const),
  );

  return sections
    .filter((section) => /^D\s+-\s+/i.test(section.title))
    .map((section) => {
      const heading = section.title.trim();
      const label = heading.replace(/^D\s+-\s+/i, "").trim();
      const slug = slugify(label);
      const bullets = parseBulletList(section.content);

      return {
        heading,
        domain: domainsBySlug.get(slug) ?? slug,
        bullets,
      };
    });
}

function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { body: markdown, fields: {} };
  }

  const raw = match[1];
  const body = markdown.slice(match[0].length);
  const lines = raw.split("\n");
  const fields: Record<string, string | string[]> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);

    if (!keyMatch) {
      continue;
    }

    const [, key, rawValue] = keyMatch;

    if (rawValue === "") {
      const items: string[] = [];

      while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
        index += 1;
        items.push(unquote(lines[index].replace(/^\s+-\s+/, "").trim()));
      }

      fields[key] = items;
      continue;
    }

    fields[key] = unquote(rawValue.trim());
  }

  return { body, fields };
}

function splitSecondLevelSections(content: string): Array<{ title: string; content: string }> {
  const matches = Array.from(content.matchAll(/^##\s+(.+)$/gm));

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const contentStart = start + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;

    return {
      title: match[1].trim(),
      content: content.slice(contentStart, end).trim(),
    };
  });
}

function splitThirdLevelSections(content: string): Array<{ title: string; content: string }> {
  const matches = Array.from(content.matchAll(/^###\s+(.+)$/gm));

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const contentStart = start + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;

    return {
      title: match[1].trim(),
      content: content.slice(contentStart, end).trim(),
    };
  });
}

function extractSection(body: string, title: string): string | null {
  const section = splitSecondLevelSections(body).find((entry) => entry.title === title);
  return section?.content ?? null;
}

function matchHeading(body: string): string | null {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function readStringField(
  fields: Record<string, string | string[]>,
  key: string,
): string | null {
  const value = fields[key];
  return typeof value === "string" ? value : null;
}

function readArrayField(
  fields: Record<string, string | string[]>,
  key: string,
): string[] {
  const value = fields[key];
  return Array.isArray(value) ? value : [];
}

function parseTier(
  raw: string | string[] | undefined,
  warnings: string[],
  label: string,
): MotifTier {
  const value = typeof raw === "string" ? Number(raw) : Number.NaN;

  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }

  if (raw !== undefined) {
    warnings.push(`Invalid ${label} value \`${String(raw)}\`; using 0.`);
  } else {
    warnings.push(`Missing ${label}; using 0.`);
  }

  return 0;
}

function parseConfidence(
  raw: string | string[] | undefined,
  warnings: string[],
  label: string,
): number {
  const value = typeof raw === "string" ? Number(raw) : Number.NaN;

  if (!Number.isNaN(value) && value >= 0 && value <= 1) {
    return value;
  }

  if (raw !== undefined) {
    warnings.push(`Invalid ${label} value \`${String(raw)}\`; using 0.`);
  } else {
    warnings.push(`Missing ${label}; using 0.`);
  }

  return 0;
}

function parseDerivativeOrder(
  raw: string | string[] | undefined,
  warnings: string[],
): number | string {
  if (typeof raw !== "string" || raw.trim() === "") {
    warnings.push("Missing `derivative_order`; using 0.");
    return 0;
  }

  const numeric = Number(raw);
  return Number.isNaN(numeric) ? raw : numeric;
}

function parsePrimaryAxis(
  raw: string | string[] | undefined,
  warnings: string[],
): MotifAxis | null {
  if (typeof raw === "string" && AXIS_ORDER.includes(raw as MotifAxis)) {
    return raw as MotifAxis;
  }

  if (raw !== undefined) {
    warnings.push(`Invalid \`primary_axis\` value \`${String(raw)}\`.`);
  } else {
    warnings.push("Missing `primary_axis`.");
  }

  return null;
}

function synthesizeAxisVector(
  primaryAxis: MotifAxis | null,
  warnings: string[],
): AxisVector {
  if (!primaryAxis) {
    warnings.push("Axis vector cannot be sourced directly from markdown; using balanced vector.");
    return {
      differentiate: 1 / 3,
      integrate: 1 / 3,
      recurse: 1 / 3,
    };
  }

  warnings.push("Axis vector synthesized from `primary_axis`; markdown schema does not provide explicit weights.");

  return {
    differentiate: primaryAxis === "differentiate" ? 1 : 0,
    integrate: primaryAxis === "integrate" ? 1 : 0,
    recurse: primaryAxis === "recurse" ? 1 : 0,
  };
}

function deriveMotifInvariants(
  structuralDescription: string,
  domainIndependent: string,
  warnings: string[],
): string[] {
  const invariants = uniqueStrings([
    ...extractSentences(structuralDescription, 2),
    ...extractSentences(domainIndependent, 1),
  ]);

  if (invariants.length === 0) {
    warnings.push("Could not derive invariants from motif sections.");
  }

  return invariants;
}

function parseBoldLabelBullets(content: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const match of content.matchAll(/^-\s+\*\*([^*]+):\*\*\s+(.+)$/gm)) {
    fields[match[1].trim()] = match[2].trim();
  }

  return fields;
}

function matchLabeledBullet(content: string, label: string): string | null {
  return content.match(new RegExp(`-\\s+${escapeRegExp(label)}:\\s+(.+)`, "i"))?.[1]?.trim() ?? null;
}

function parseBulletList(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function parseIndentedBullets(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function inferOperatorTags(text: string): AlgebraOperator[] {
  const operators = OPERATOR_KEYWORDS
    .filter(([, pattern]) => pattern.test(text))
    .map(([operator]) => operator)
    .filter((operator): operator is AlgebraOperator => ALGEBRA_OPERATORS.includes(operator));

  return uniqueStrings(operators) as AlgebraOperator[];
}

function normalizeSourceType(
  raw: string | string[] | undefined,
  warnings: string[],
  label: string,
  fallback: MotifSourceType = "session-derived",
): MotifSourceType {
  if (typeof raw === "string" && SOURCE_TYPES.has(raw as MotifSourceType)) {
    return raw as MotifSourceType;
  }

  if (typeof raw === "string") {
    warnings.push(`Invalid ${label} value \`${raw}\`; using \`${fallback}\`.`);
  } else {
    warnings.push(`Missing ${label}; using \`${fallback}\`.`);
  }

  return fallback;
}

function inferMotifSourceFromInstances(instances: InstanceRecord[]): MotifSourceType {
  const types = uniqueStrings(instances.map((instance) => instance.sourceType));

  if (types.includes("top-down") && types.includes("bottom-up")) {
    return "triangulated";
  }

  return (types[0] as MotifSourceType | undefined) ?? "session-derived";
}

function inferSourceTypeFromText(raw: string | undefined): MotifSourceType | undefined {
  if (!raw) {
    return undefined;
  }

  if (/triangulat/i.test(raw)) {
    return "triangulated";
  }

  if (/bottom-up/i.test(raw)) {
    return "bottom-up";
  }

  if (/top-down/i.test(raw)) {
    return "top-down";
  }

  return undefined;
}

function inferSourceTypeFromUnknown(
  raw: string | string[] | undefined,
): MotifSourceType | undefined {
  if (typeof raw === "string") {
    return inferSourceTypeFromText(raw);
  }

  if (Array.isArray(raw)) {
    for (const value of raw) {
      const inferred = inferSourceTypeFromText(value);
      if (inferred) {
        return inferred;
      }
    }
  }

  return undefined;
}

function extractSentences(content: string, limit: number): string[] {
  if (!content.trim()) {
    return [];
  }

  return content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function firstSentence(content: string): string | null {
  return extractSentences(content, 1)[0] ?? null;
}

function compact(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
