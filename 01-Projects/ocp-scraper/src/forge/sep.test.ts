import { describe, expect, test } from 'bun:test';

import {
  buildSepEntryUrl,
  filterContentsEntries,
  normalizeSepSlug,
  parseSepContents,
  parseSepEntry,
} from './sep';

describe('SEP adapter helpers', () => {
  test('normalizes SEP slugs and URLs', () => {
    expect(normalizeSepSlug('sep/autopoiesis')).toBe('autopoiesis');
    expect(normalizeSepSlug('https://plato.stanford.edu/entries/embodied-cognition/')).toBe('embodied-cognition');
    expect(buildSepEntryUrl('embodied-cognition')).toBe('https://plato.stanford.edu/entries/embodied-cognition/');
  });

  test('parses contents entries and filters by keyword', () => {
    const html = `
      <h2>A</h2>
      <ul>
        <li><a href="entries/artificial-intelligence/">Artificial Intelligence</a> (Selmer Bringsjord and Naveen Sundar Govindarajulu)</li>
        <li><a href="entries/autopoiesis/">Autopoiesis</a> (Example Author)</li>
      </ul>
    `;
    const entries = parseSepContents(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.slug).toBe('artificial-intelligence');
    expect(filterContentsEntries(entries, 'autopoiesis')).toEqual([
      expect.objectContaining({ slug: 'autopoiesis' }),
    ]);
  });

  test('parses preamble, first section, authors, and related entry slugs', () => {
    const html = `
      <html><body>
        <div id="main-text">
          <h1>Embodied Cognition</h1>
          <p><em>First published Fri Jun 25, 2021; substantive revision Fri Jan 9, 2026</em></p>
          <p>Embodied Cognition is a wide-ranging research program.</p>
          <p>It emphasizes the significance of an agent's body in cognition.</p>
          <h2 id="Sec1">1. The Foils and Inspirations for Embodied Cognition</h2>
          <p>The ontological and methodological commitments of traditional computational cognitive science are well understood.</p>
          <p>Ecological psychology and phenomenology both matter here.</p>
          <h2 id="Rel">Related Entries</h2>
          <ul>
            <li><a href="../entries/phenomenology/">phenomenology</a></li>
            <li><a href="../entries/artificial-intelligence/">artificial intelligence</a></li>
          </ul>
          <div id="article-copyright"></div>
        </div>
      </body></html>
    `;

    const entry = parseSepEntry(html, 'embodied-cognition', {
      authors: ['Lawrence Shapiro', 'Shannon Spaulding'],
    });

    expect(entry.title).toBe('Embodied Cognition');
    expect(entry.preamble).toContain('wide-ranging research program');
    expect(entry.firstSectionTitle).toContain('Foils and Inspirations');
    expect(entry.firstSectionText).toContain('traditional computational cognitive science');
    expect(entry.relatedEntries).toEqual(['phenomenology', 'artificial-intelligence']);
    expect(entry.publishedAt).toBe('2021-06-25T00:00:00.000Z');
    expect(entry.revisedAt).toBe('2026-01-09T00:00:00.000Z');
  });
});
