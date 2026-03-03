/**
 * Stage 2: Fine filter — evaluates README quality heuristically.
 * Requires README content. Structural pattern matching, not NLU.
 */

export interface ReadmeQuality {
  wordCount: number;
  sectionCount: number;
  hasInstallation: boolean;
  hasUsage: boolean;
  hasDescription: boolean;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  hasLicense: boolean;
  hasBadges: boolean;
  score: number; // 0.0 - 1.0
}

export interface FineFilterConfig {
  minWordCount: number;
  minSections: number;
  minScore: number;
  requireInstallation: boolean;
  requireUsage: boolean;
}

export const DEFAULT_FINE_CONFIG: FineFilterConfig = {
  minWordCount: 100,
  minSections: 3,
  minScore: 0.3,
  requireInstallation: false,
  requireUsage: false,
};

export interface FineFilterResult {
  passed: boolean;
  quality: ReadmeQuality;
  reasons: string[];
}

/**
 * Analyze README structural quality using heuristic checks.
 */
export function analyzeReadme(content: string): ReadmeQuality {
  const lines = content.split('\n');
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  // Count markdown headings (# through ###)
  const headings = lines.filter(l => /^#{1,3}\s+/.test(l));
  const sectionCount = headings.length;

  // Check for key sections (case-insensitive heading matching)
  const headingTexts = headings.map(h => h.replace(/^#+\s*/, '').toLowerCase());

  const installPatterns = ['install', 'installation', 'getting started', 'setup', 'quick start', 'quickstart'];
  const usagePatterns = ['usage', 'example', 'examples', 'how to use', 'tutorial', 'guide', 'demo'];
  const descPatterns = ['about', 'overview', 'introduction', 'what is', 'description', 'features'];
  const licensePatterns = ['license', 'licence'];

  const hasInstallation = installPatterns.some(p => headingTexts.some(h => h.includes(p)));
  const hasUsage = usagePatterns.some(p => headingTexts.some(h => h.includes(p)));
  const hasDescription = descPatterns.some(p => headingTexts.some(h => h.includes(p)));
  const hasLicense = licensePatterns.some(p => headingTexts.some(h => h.includes(p)));

  // Count code blocks
  const codeBlockMatches = content.match(/```[\s\S]*?```/g);
  const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
  const hasCodeBlocks = codeBlockCount > 0;

  // Check for badges (common markdown badge patterns)
  const hasBadges = /\[!\[.*?\]\(.*?\)\]\(.*?\)/.test(content) || /!\[.*?badge.*?\]/i.test(content);

  // Calculate quality score (0.0 - 1.0)
  let score = 0;

  // Word count contribution (up to 0.25)
  score += Math.min(wordCount / 500, 1.0) * 0.25;

  // Section count contribution (up to 0.20)
  score += Math.min(sectionCount / 5, 1.0) * 0.20;

  // Key sections contribution (up to 0.30)
  if (hasInstallation) score += 0.10;
  if (hasUsage) score += 0.10;
  if (hasDescription) score += 0.10;

  // Code blocks contribution (up to 0.15)
  score += Math.min(codeBlockCount / 3, 1.0) * 0.15;

  // Extras (up to 0.10)
  if (hasLicense) score += 0.05;
  if (hasBadges) score += 0.05;

  return {
    wordCount,
    sectionCount,
    hasInstallation,
    hasUsage,
    hasDescription,
    hasCodeBlocks,
    codeBlockCount,
    hasLicense,
    hasBadges,
    score: Math.round(score * 100) / 100,
  };
}

/**
 * Fine filter — evaluates README quality against thresholds.
 */
export function fineFilter(readmeContent: string, config: FineFilterConfig = DEFAULT_FINE_CONFIG): FineFilterResult {
  const quality = analyzeReadme(readmeContent);
  const reasons: string[] = [];

  if (quality.wordCount < config.minWordCount) {
    reasons.push(`word count ${quality.wordCount} < ${config.minWordCount}`);
  }

  if (quality.sectionCount < config.minSections) {
    reasons.push(`sections ${quality.sectionCount} < ${config.minSections}`);
  }

  if (quality.score < config.minScore) {
    reasons.push(`quality score ${quality.score} < ${config.minScore}`);
  }

  if (config.requireInstallation && !quality.hasInstallation) {
    reasons.push('missing installation section');
  }

  if (config.requireUsage && !quality.hasUsage) {
    reasons.push('missing usage section');
  }

  return {
    passed: reasons.length === 0,
    quality,
    reasons,
  };
}
