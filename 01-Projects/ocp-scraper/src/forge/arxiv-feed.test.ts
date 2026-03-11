import { describe, expect, test } from 'bun:test';

import { normalizeArxivId, parseArxivFeed } from './arxiv-feed';

const FULL_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:arxiv="http://arxiv.org/schemas/atom"
      xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <id>http://arxiv.org/api/q7RjN</id>
  <title type="html">ArXiv Query: all:agentic memory</title>
  <updated>2026-03-10T00:00:00Z</updated>
  <opensearch:totalResults>1234</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <opensearch:itemsPerPage>2</opensearch:itemsPerPage>
  <entry>
    <id>http://arxiv.org/abs/2501.01234v2</id>
    <updated>2025-01-10T11:22:33Z</updated>
    <published>2025-01-09T08:00:00Z</published>
    <title>
      Agentic Memory for Scientific Discovery
    </title>
    <summary>
      We study memory-backed agents &amp; show how retrieval changes performance.
    </summary>
    <author><name>Jane Doe</name></author>
    <author><name>John Smith</name></author>
    <arxiv:doi>10.1000/example-doi</arxiv:doi>
    <link rel="alternate" type="text/html" href="https://arxiv.org/abs/2501.01234v2" />
    <link title="pdf" rel="related" type="application/pdf" href="https://arxiv.org/pdf/2501.01234v2.pdf" />
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom" />
    <category term="cs.IR" scheme="http://arxiv.org/schemas/atom" />
  </entry>
  <entry>
    <id>arXiv:2501.09999</id>
    <updated>2025-01-11T00:00:00Z</updated>
    <published>2025-01-10T00:00:00Z</published>
    <title>Plain Entry</title>
    <summary>Second paper.</summary>
    <author><name>Alice Example</name></author>
    <link rel="related" type="application/pdf" href="https://arxiv.org/pdf/2501.09999.pdf" />
    <category term="cs.LG" />
  </entry>
</feed>`;

const SPARSE_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:arxiv="http://arxiv.org/schemas/atom"
      xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <title>Sparse feed</title>
  <entry>
    <id>http://arxiv.org/abs/2502.00001</id>
    <title>  Sparse   Title  </title>
    <summary>
      Text with
      irregular spacing.
    </summary>
    <author><name> Solo Author </name></author>
  </entry>
  <entry>
    <title>Missing id entry</title>
    <summary />
  </entry>
</feed>`;

describe('parseArxivFeed', () => {
  test('parses namespaced feed metadata and entries', () => {
    const feed = parseArxivFeed(FULL_FEED_XML);

    expect(feed.totalResults).toBe(1234);
    expect(feed.startIndex).toBe(0);
    expect(feed.itemsPerPage).toBe(2);
    expect(feed.entries).toHaveLength(2);

    expect(feed.entries[0]).toEqual({
      arxivId: '2501.01234v2',
      title: 'Agentic Memory for Scientific Discovery',
      authors: ['Jane Doe', 'John Smith'],
      abstract: 'We study memory-backed agents & show how retrieval changes performance.',
      categories: ['cs.AI', 'cs.IR'],
      published: '2025-01-09T08:00:00Z',
      updated: '2025-01-10T11:22:33Z',
      doi: '10.1000/example-doi',
      pdfUrl: 'https://arxiv.org/pdf/2501.01234v2.pdf',
    });

    expect(feed.entries[1]).toEqual({
      arxivId: '2501.09999',
      title: 'Plain Entry',
      authors: ['Alice Example'],
      abstract: 'Second paper.',
      categories: ['cs.LG'],
      published: '2025-01-10T00:00:00Z',
      updated: '2025-01-11T00:00:00Z',
      doi: null,
      pdfUrl: 'https://arxiv.org/pdf/2501.09999.pdf',
    });
  });

  test('handles sparse entries and missing opensearch metadata gracefully', () => {
    const feed = parseArxivFeed(SPARSE_FEED_XML);

    expect(feed.totalResults).toBeNull();
    expect(feed.startIndex).toBeNull();
    expect(feed.itemsPerPage).toBeNull();
    expect(feed.entries).toEqual([
      {
        arxivId: '2502.00001',
        title: 'Sparse Title',
        authors: ['Solo Author'],
        abstract: 'Text with irregular spacing.',
        categories: [],
        published: null,
        updated: null,
        doi: null,
        pdfUrl: null,
      },
      {
        arxivId: null,
        title: 'Missing id entry',
        authors: [],
        abstract: '',
        categories: [],
        published: null,
        updated: null,
        doi: null,
        pdfUrl: null,
      },
    ]);
  });

  test('rejects malformed XML', () => {
    expect(() => parseArxivFeed('<feed><entry></feed>')).toThrow(/Invalid arXiv feed XML/);
  });
});

describe('normalizeArxivId', () => {
  test('normalizes canonical arxiv identifiers', () => {
    expect(normalizeArxivId('arXiv:2301.07041')).toBe('2301.07041');
    expect(normalizeArxivId('https://arxiv.org/abs/2301.07041')).toBe('2301.07041');
    expect(normalizeArxivId('https://arxiv.org/pdf/2301.07041.pdf')).toBe('2301.07041');
  });
});
