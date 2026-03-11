export interface ArxivFeedEntry {
  arxivId: string | null;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  published: string | null;
  updated: string | null;
  doi: string | null;
  pdfUrl: string | null;
}

export interface ArxivFeed {
  totalResults: number | null;
  startIndex: number | null;
  itemsPerPage: number | null;
  entries: ArxivFeedEntry[];
}

export function parseArxivFeed(xml: string): ArxivFeed {
  assertWellFormedXml(xml);

  return {
    totalResults: parseOptionalInteger(extractTagText(xml, 'opensearch:totalResults')),
    startIndex: parseOptionalInteger(extractTagText(xml, 'opensearch:startIndex')),
    itemsPerPage: parseOptionalInteger(extractTagText(xml, 'opensearch:itemsPerPage')),
    entries: extractBlocks(xml, 'entry').map(parseArxivEntry),
  };
}

export function parseArxivEntry(entryXml: string): ArxivFeedEntry {
  const idText = extractTagText(entryXml, 'id');

  return {
    arxivId: idText ? normalizeArxivId(idText) : null,
    title: normalizeText(extractTagText(entryXml, 'title') ?? ''),
    authors: extractBlocks(entryXml, 'author')
      .map((authorXml) => normalizeText(extractTagText(authorXml, 'name') ?? ''))
      .filter(Boolean),
    abstract: normalizeText(extractTagText(entryXml, 'summary') ?? ''),
    categories: extractCategoryTerms(entryXml),
    published: normalizeOptionalText(extractTagText(entryXml, 'published')),
    updated: normalizeOptionalText(extractTagText(entryXml, 'updated')),
    doi: normalizeOptionalText(extractTagText(entryXml, 'arxiv:doi')),
    pdfUrl: extractPdfUrl(entryXml),
  };
}

export function normalizeArxivId(value: string): string {
  return value
    .trim()
    .replace(/^arxiv:/i, '')
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/\.pdf$/i, '');
}

function extractPdfUrl(entryXml: string): string | null {
  for (const attrs of extractStartTags(entryXml, 'link')) {
    const title = normalizeOptionalText(extractAttribute(attrs, 'title'));
    const href = normalizeOptionalText(extractAttribute(attrs, 'href'));

    if (!href) {
      continue;
    }

    if (title?.toLowerCase() === 'pdf' || href.toLowerCase().endsWith('.pdf')) {
      return href;
    }
  }

  return null;
}

function extractCategoryTerms(entryXml: string): string[] {
  return extractStartTags(entryXml, 'category')
    .map((attrs) => normalizeText(decodeXml(extractAttribute(attrs, 'term') ?? '')))
    .filter(Boolean);
}

function extractBlocks(xml: string, tagName: string): string[] {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tagName)}>`,'g');
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function extractTagText(xml: string, tagName: string): string | null {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tagName)}>`);
  const match = xml.match(pattern);
  return match ? normalizeOptionalText(decodeXml(stripCdata(match[1]))) : null;
}

function extractStartTags(xml: string, tagName: string): string[] {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*)/?>(?![\\s\\S]*</${escapeRegExp(tagName)}>)`, 'g');
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function extractAttribute(attributes: string, attributeName: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(attributeName)}=(['"])([\\s\\S]*?)\\1`);
  const match = attributes.match(pattern);
  return match ? decodeXml(match[2]) : null;
}

function assertWellFormedXml(xml: string): void {
  const stack: string[] = [];
  const tokens = xml.match(/<[^>]+>/g) ?? [];

  for (const token of tokens) {
    if (token.startsWith('<?') || token.startsWith('<!')) {
      continue;
    }

    if (token.startsWith('</')) {
      const closingTag = normalizeTagName(token.slice(2, -1));
      const openingTag = stack.pop();

      if (openingTag !== closingTag) {
        throw new Error(`Invalid arXiv feed XML: unexpected closing tag </${closingTag}>`);
      }

      continue;
    }

    if (token.endsWith('/>')) {
      continue;
    }

    stack.push(normalizeTagName(token.slice(1, -1)));
  }

  if (stack.length > 0) {
    throw new Error(`Invalid arXiv feed XML: unclosed tag <${stack[stack.length - 1]}>`);
  }

  if (!/<feed(?:\s[^>]*)?>/.test(xml)) {
    throw new Error('Invalid arXiv feed XML: missing <feed> root element');
  }
}

function normalizeOptionalText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTagName(rawTag: string): string {
  return rawTag.trim().split(/\s+/, 1)[0] ?? '';
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}
