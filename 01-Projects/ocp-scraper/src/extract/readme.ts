/**
 * README Structural Parser
 * Extracts structured information from README markdown using
 * heading-based section detection and pattern matching.
 * NO NLU, NO LLM — purely heuristic.
 */

/** A parsed section from the README */
export interface ReadmeSection {
  heading: string;
  level: number; // 1-6 for # through ######
  content: string;
  type: SectionType;
}

export type SectionType =
  | 'title'
  | 'description'
  | 'installation'
  | 'usage'
  | 'api'
  | 'configuration'
  | 'features'
  | 'examples'
  | 'contributing'
  | 'license'
  | 'changelog'
  | 'faq'
  | 'troubleshooting'
  | 'unknown';

/** Parsed README structure */
export interface ParsedReadme {
  title: string | null;
  description: string | null;
  problemStatement: string | null;
  sections: ReadmeSection[];
  installSnippet: string | null;
  usageSnippet: string | null;
  featureList: string[];
  hasTableOfContents: boolean;
}

/** Section type detection patterns */
const SECTION_PATTERNS: Record<SectionType, RegExp[]> = {
  title: [], // Title is the first H1
  description: [/about/i, /overview/i, /introduction/i, /what is/i, /summary/i],
  installation: [/install/i, /getting started/i, /setup/i, /quick\s*start/i, /requirements/i, /prerequisites/i],
  usage: [/usage/i, /how to use/i, /basic usage/i, /guide/i, /tutorial/i],
  api: [/api/i, /reference/i, /documentation/i, /docs/i, /methods/i],
  configuration: [/config/i, /options/i, /settings/i, /environment/i, /env/i],
  features: [/features/i, /highlights/i, /capabilities/i, /what it does/i, /why/i],
  examples: [/example/i, /demo/i, /sample/i, /showcase/i],
  contributing: [/contribut/i, /development/i, /how to help/i],
  license: [/licen[sc]e/i, /copyright/i],
  changelog: [/changelog/i, /release/i, /version/i, /history/i, /what's new/i],
  faq: [/faq/i, /frequently asked/i, /questions/i],
  troubleshooting: [/troubleshoot/i, /common issues/i, /problems/i, /debugging/i],
  unknown: [],
};

/**
 * Classify a heading into a section type.
 */
function classifySection(heading: string): SectionType {
  for (const [type, patterns] of Object.entries(SECTION_PATTERNS)) {
    if (type === 'title' || type === 'unknown') continue;
    for (const pattern of patterns) {
      if (pattern.test(heading)) return type as SectionType;
    }
  }
  return 'unknown';
}

/**
 * Extract the first code block from a section's content.
 */
function extractFirstCodeBlock(content: string): string | null {
  const match = content.match(/```[\w]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

/**
 * Extract a feature list from content (bulleted or numbered lists).
 */
function extractFeatureList(content: string): string[] {
  const features: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*[-*+]\s+(.+)/) || line.match(/^\s*\d+[.)]\s+(.+)/);
    if (match) {
      features.push(match[1].trim());
    }
  }
  return features;
}

/**
 * Derive a problem statement from the README.
 * Tries: first paragraph, description section, or first non-heading paragraph.
 */
function deriveProblemStatement(title: string | null, sections: ReadmeSection[], preamble: string): string | null {
  // Try description section first
  const descSection = sections.find(s => s.type === 'description');
  if (descSection) {
    const firstPara = descSection.content.split('\n\n')[0]?.trim();
    if (firstPara && firstPara.length > 20) return firstPara;
  }

  // Try preamble (text between title and first heading)
  if (preamble.length > 20) {
    const firstPara = preamble.split('\n\n')[0]?.trim();
    if (firstPara && firstPara.length > 20) return firstPara;
  }

  // Try features section
  const featSection = sections.find(s => s.type === 'features');
  if (featSection) {
    const firstPara = featSection.content.split('\n\n')[0]?.trim();
    if (firstPara && firstPara.length > 20) return firstPara;
  }

  // Fallback: use title if available
  if (title) return `${title} — problem statement could not be extracted from README`;

  return null;
}

/**
 * Parse a README markdown string into structured sections.
 */
export function parseReadme(content: string): ParsedReadme {
  const lines = content.split('\n');
  let title: string | null = null;
  let preamble = '';
  const sections: ReadmeSection[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentLines: string[] = [];
  let foundFirstHeading = false;
  let collectingPreamble = false;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch) {
      // Save previous section
      if (currentHeading !== null) {
        const content = currentLines.join('\n').trim();
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content,
          type: classifySection(currentHeading),
        });
      }

      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

      // First H1 is the title
      if (level === 1 && !title) {
        title = heading;
        collectingPreamble = true;
        currentHeading = null;
        currentLines = [];
        continue;
      }

      foundFirstHeading = true;
      collectingPreamble = false;
      currentHeading = heading;
      currentLevel = level;
      currentLines = [];
    } else {
      if (collectingPreamble && !foundFirstHeading) {
        preamble += line + '\n';
      }
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentHeading !== null) {
    const content = currentLines.join('\n').trim();
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      content,
      type: classifySection(currentHeading),
    });
  }

  // Extract specific content
  const installSection = sections.find(s => s.type === 'installation');
  const usageSection = sections.find(s => s.type === 'usage');
  const featuresSection = sections.find(s => s.type === 'features');

  const installSnippet = installSection ? extractFirstCodeBlock(installSection.content) : null;
  const usageSnippet = usageSection ? extractFirstCodeBlock(usageSection.content) : null;
  const featureList = featuresSection ? extractFeatureList(featuresSection.content) : [];

  // Check for table of contents
  const hasTableOfContents = content.includes('## Table of Contents') ||
    content.includes('## Contents') ||
    (content.match(/\[.*?\]\(#.*?\)/g)?.length || 0) >= 3;

  // Derive problem statement
  const description = preamble.trim() || null;
  const problemStatement = deriveProblemStatement(title, sections, preamble.trim());

  return {
    title,
    description,
    problemStatement,
    sections,
    installSnippet,
    usageSnippet,
    featureList,
    hasTableOfContents,
  };
}
