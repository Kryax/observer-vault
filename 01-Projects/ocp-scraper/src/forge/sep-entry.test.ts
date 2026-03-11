import { describe, expect, test } from 'bun:test';

import { buildSepCanonicalUrl, parseSepEntryHtml } from './sep-entry';

describe('SEP entry HTML parsing', () => {
  test('parses canonical metadata, intro, first section, related entries, and bibliography', () => {
    const html = `
      <html>
        <head>
          <title>Embodied Cognition</title>
          <link rel="canonical" href="https://plato.stanford.edu/entries/embodied-cognition/">
          <meta name="citation_author" content="Lawrence Shapiro and Shannon Spaulding">
        </head>
        <body>
          <div id="main-text">
            <h1>Embodied Cognition</h1>
            <p><em>First published Fri Jun 25, 2021; substantive revision Fri Jan 9, 2026</em></p>
            <p>Embodied cognition is a wide-ranging research program in philosophy and cognitive science.</p>
            <p>It emphasizes the significance of bodily form and situated action in cognition.</p>
            <h2 id="Sec1">1. The Foils and Inspirations for Embodied Cognition</h2>
            <p>Traditional computational cognitive science provides one foil for embodied approaches.</p>
            <p>Ecological psychology and phenomenology provide another set of inspirations.</p>
            <h2 id="Rel">Related Entries</h2>
            <ul>
              <li><a href="../entries/phenomenology/">Phenomenology</a></li>
              <li><a href="../entries/artificial-intelligence/">Artificial Intelligence</a></li>
            </ul>
            <h2 id="Bib">Bibliography</h2>
            <ul class="hanging">
              <li>Clark, Andy, 1997, <em>Being There</em>, Cambridge, MA: MIT Press.</li>
              <li>Varela, Francisco J., Evan Thompson, and Eleanor Rosch, 1991, <em>The Embodied Mind</em>, Cambridge, MA: MIT Press.</li>
            </ul>
            <div id="article-copyright"></div>
          </div>
        </body>
      </html>
    `;

    const parsed = parseSepEntryHtml(html, 'embodied-cognition');

    expect(parsed.title).toBe('Embodied Cognition');
    expect(parsed.authors).toEqual(['Lawrence Shapiro', 'Shannon Spaulding']);
    expect(parsed.preamble).toContain('wide-ranging research program');
    expect(parsed.firstSectionTitle).toBe('1. The Foils and Inspirations for Embodied Cognition');
    expect(parsed.firstSectionText).toContain('Traditional computational cognitive science');
    expect(parsed.relatedEntries).toEqual([
      { slug: 'phenomenology', title: 'Phenomenology' },
      { slug: 'artificial-intelligence', title: 'Artificial Intelligence' },
    ]);
    expect(parsed.bibliography).toEqual([
      expect.objectContaining({
        authors: ['Clark, Andy'],
        year: '1997',
        title: 'Being There',
      }),
      expect.objectContaining({
        authors: ['Varela, Francisco J.', 'Evan Thompson', 'Eleanor Rosch'],
        year: '1991',
        title: 'The Embodied Mind',
      }),
    ]);
    expect(parsed.canonicalUrl).toBe('https://plato.stanford.edu/entries/embodied-cognition/');
    expect(parsed.publishedAt).toBe('2021-06-25T00:00:00.000Z');
    expect(parsed.revisedAt).toBe('2026-01-09T00:00:00.000Z');
  });

  test('handles aueditable/pubinfo layout with fallback canonical URL', () => {
    const html = `
      <html>
        <head>
          <meta property="og:url" content="https://plato.stanford.edu/entries/james/">
        </head>
        <body>
          <div id="pubinfo">Edward N. Zalta and Uri Nodelman (eds.), by Ruth Anna Putnam. First published Sun Sep 9, 2001; substantive revision Tue May 14, 2019.</div>
          <div id="aueditable">
            <h1>William James</h1>
            <p>James develops a pluralistic and pragmatic philosophical outlook.</p>
            <p>His work spans psychology, metaphysics, and ethics.</p>
            <h3>1. Life and Writings</h3>
            <p>James studied medicine, taught psychology, and transformed American philosophy.</p>
            <h3>Related Entries</h3>
            <p><a href="../entries/pragmatism/">Pragmatism</a>; <a href="../entries/peirce/">Charles Sanders Peirce</a></p>
            <h3>Bibliography</h3>
            <p>Putnam, Ruth Anna, 2001, "William James", <em>SEP</em>.</p>
          </div>
        </body>
      </html>
    `;

    const parsed = parseSepEntryHtml(html, 'james');

    expect(parsed.title).toBe('William James');
    expect(parsed.authors).toEqual(['Ruth Anna Putnam']);
    expect(parsed.preamble).toContain('pluralistic and pragmatic');
    expect(parsed.firstSectionTitle).toBe('1. Life and Writings');
    expect(parsed.firstSectionText).toContain('transformed American philosophy');
    expect(parsed.relatedEntries).toEqual([
      { slug: 'pragmatism', title: 'Pragmatism' },
      { slug: 'peirce', title: 'Charles Sanders Peirce' },
    ]);
    expect(parsed.bibliography[0]).toEqual(expect.objectContaining({
      authors: ['Putnam, Ruth Anna'],
      year: '2001',
      title: 'William James',
    }));
    expect(parsed.canonicalUrl).toBe('https://plato.stanford.edu/entries/james/');
    expect(parsed.publishedAt).toBe('2001-09-09T00:00:00.000Z');
    expect(parsed.revisedAt).toBe('2019-05-14T00:00:00.000Z');
  });

  test('gracefully handles sparse entry pages with minimal metadata', () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Modal Fictionalism</h1>
            <p>This entry outlines fictionalist approaches to modal discourse.</p>
            <h2>1. Core Idea</h2>
            <p>Modal fictionalists explain possibility claims via a useful fiction.</p>
          </article>
        </body>
      </html>
    `;

    const parsed = parseSepEntryHtml(html, 'modal-fictionalism', {
      authors: ['Example Author'],
    });

    expect(parsed.title).toBe('Modal Fictionalism');
    expect(parsed.authors).toEqual(['Example Author']);
    expect(parsed.preamble).toBe('This entry outlines fictionalist approaches to modal discourse.');
    expect(parsed.firstSectionTitle).toBe('1. Core Idea');
    expect(parsed.firstSectionText).toBe('Modal fictionalists explain possibility claims via a useful fiction.');
    expect(parsed.relatedEntries).toEqual([]);
    expect(parsed.bibliography).toEqual([]);
    expect(parsed.canonicalUrl).toBe(buildSepCanonicalUrl('modal-fictionalism'));
    expect(parsed.publishedAt).toBeNull();
    expect(parsed.revisedAt).toBeNull();
  });
});
