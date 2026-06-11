/**
 * Built-in search index (signalxjs/ssg#62): `search: true` emits a
 * `search-index.json` over the rendered pages at build time. Evidence of
 * need: the docs site hand-rolled a ⌘K palette over nav titles only — no
 * content search was possible without an index.
 */

import { describe, it, expect } from 'vitest';
import { extractSearchText, buildSearchIndex, writeSearchIndex } from '../search';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PageBuildResult } from '../types';

function page(p: string, meta: Record<string, unknown> = {}): PageBuildResult {
    return { path: p, file: `${p}/index.html`, time: 1, size: 100, meta };
}

const HTML = (body: string) =>
    `<!DOCTYPE html><html><head><title>t</title><style>.x{}</style></head><body>${body}</body></html>`;

describe('extractSearchText (#62)', () => {
    it('prefers <main> content over the rest of the body', () => {
        const text = extractSearchText(
            HTML('<nav>Site Nav Links</nav><main><h1>Guide</h1><p>Real content here.</p></main><footer>Footer</footer>')
        );
        expect(text).toContain('Real content here.');
        expect(text).not.toContain('Site Nav Links');
        expect(text).not.toContain('Footer');
    });

    it('falls back to body text when there is no <main>, stripping script/style', () => {
        const text = extractSearchText(
            HTML('<p>Visible</p><script>var hidden = 1;</script><style>.h{}</style>')
        );
        expect(text).toContain('Visible');
        expect(text).not.toContain('hidden');
        expect(text).not.toContain('.h{}');
    });

    it('collapses whitespace and decodes common entities', () => {
        const text = extractSearchText(HTML('<main><p>a&amp;b   &lt;c&gt;\n\n  d&#39;e</p></main>'));
        expect(text).toBe("a&b <c> d'e");
    });
});

describe('buildSearchIndex (#62) — headings from rendered HTML', () => {
    it('extracts id-carrying headings from the page when meta has none', () => {
        const html = HTML(
            '<main><h1>Page</h1>' +
                '<h2 id="install">Install<a class="heading-anchor" href="#install">#</a></h2>' +
                '<h3 id="from-npm">From npm</h3>' +
                '<h2>No id, skipped</h2></main>'
        );
        const entries = buildSearchIndex([{ page: page('/guide', { title: 'G' }), html }]);
        expect(entries[0].headings).toEqual([
            { id: 'install', text: 'Install', level: 2 },
            { id: 'from-npm', text: 'From npm', level: 3 },
        ]);
    });

    it('prefers meta.headings when present', () => {
        const html = HTML('<main><h2 id="other">Other</h2></main>');
        const entries = buildSearchIndex([
            { page: page('/x', { title: 'X', headings: [{ id: 'a', text: 'A', level: 2 }] }), html },
        ]);
        expect(entries[0].headings).toEqual([{ id: 'a', text: 'A', level: 2 }]);
    });
});

describe('buildSearchIndex (#62)', () => {
    const html = HTML('<main><p>Some indexed words.</p></main>');

    it('builds one entry per page with title, description, headings, and text', () => {
        const entries = buildSearchIndex([
            {
                page: page('/guide', {
                    title: 'Guide',
                    description: 'How to start',
                    headings: [{ id: 'install', text: 'Install', level: 2 }],
                }),
                html,
            },
        ]);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            path: '/guide',
            title: 'Guide',
            description: 'How to start',
            headings: [{ id: 'install', text: 'Install', level: 2 }],
        });
        expect(entries[0].text).toContain('Some indexed words.');
    });

    it('excludes noindex pages and the 404 page, like the sitemap', () => {
        const entries = buildSearchIndex([
            { page: page('/secret', { robots: 'noindex, nofollow' }), html },
            { page: page('/404'), html },
            { page: page('/ok', { title: 'Ok' }), html },
        ]);
        expect(entries.map((e) => e.path)).toEqual(['/ok']);
    });

    it('falls back to the path when a page has no title', () => {
        const entries = buildSearchIndex([{ page: page('/no-title'), html }]);
        expect(entries[0].title).toBe('/no-title');
    });

    it('caps the indexed text per page', () => {
        const long = HTML(`<main><p>${'word '.repeat(5000)}</p></main>`);
        const entries = buildSearchIndex([{ page: page('/long', { title: 'L' }), html: long }]);
        expect(entries[0].text.length).toBeLessThanOrEqual(8000);
    });
});

describe('writeSearchIndex (#62)', () => {
    it('writes a versioned JSON index to outDir', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-search-'));
        try {
            await writeSearchIndex(
                buildSearchIndex([{ page: page('/a', { title: 'A' }), html: HTML('<main>aaa</main>') }]),
                outDir,
                {}
            );
            const index = JSON.parse(fs.readFileSync(path.join(outDir, 'search-index.json'), 'utf-8'));
            expect(index.version).toBe(1);
            expect(index.entries).toHaveLength(1);
            expect(index.entries[0].path).toBe('/a');
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    it('honors a custom output filename', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-search2-'));
        try {
            await writeSearchIndex([], outDir, { output: 'idx.json' });
            expect(fs.existsSync(path.join(outDir, 'idx.json'))).toBe(true);
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });
});
