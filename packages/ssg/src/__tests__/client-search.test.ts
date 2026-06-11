/**
 * Client search over the build-time index (signalxjs/ssg#62):
 * `searchPages(entries, query)` is the pure, dependency-free ranking the
 * theme command palette uses; `loadSearchIndex()` fetches the emitted
 * `search-index.json`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchPages, loadSearchIndex, type SearchIndexEntry } from '../client';

const ENTRIES: SearchIndexEntry[] = [
    {
        path: '/guide',
        title: 'Getting started',
        description: 'Install and run',
        headings: [{ id: 'install', text: 'Install the package', level: 2 }],
        text: 'Getting started with the generator. Install the package and run the dev server.',
    },
    {
        path: '/api',
        title: 'API reference',
        headings: [{ id: 'config', text: 'Config options', level: 2 }],
        text: 'Every config option, including install hooks.',
    },
    {
        path: '/blog/hello',
        title: 'Hello world',
        headings: [],
        text: 'A first post that mentions nothing relevant.',
    },
];

describe('searchPages (#62)', () => {
    it('ranks title matches above heading matches above body matches', () => {
        const results = searchPages(ENTRIES, 'install');
        // /guide matches in heading + body, /api only in body.
        expect(results.map((r) => r.path)).toEqual(['/guide', '/api']);

        const byTitle = searchPages(ENTRIES, 'reference');
        expect(byTitle[0].path).toBe('/api');
    });

    it('requires every term to match somewhere (AND semantics)', () => {
        expect(searchPages(ENTRIES, 'install server').map((r) => r.path)).toEqual(['/guide']);
        expect(searchPages(ENTRIES, 'install zebra')).toEqual([]);
    });

    it('returns the anchor of the best matching heading', () => {
        const [top] = searchPages(ENTRIES, 'install');
        expect(top.anchor).toBe('#install');
    });

    it('anchors to the heading matching the most query terms', () => {
        const entries = [
            {
                path: '/p',
                title: 'Page',
                headings: [
                    { id: 'install-only', text: 'Install', level: 2 },
                    { id: 'install-server', text: 'Install the dev server', level: 2 },
                ],
                text: 'install dev server words',
            },
        ];
        const [top] = searchPages(entries, 'install server');
        expect(top.anchor).toBe('#install-server');
    });

    it('returns an excerpt around the first body match', () => {
        const [top] = searchPages(ENTRIES, 'dev server');
        expect(top.path).toBe('/guide');
        expect(top.excerpt).toContain('dev server');
    });

    it('is case-insensitive and returns [] for an empty query', () => {
        expect(searchPages(ENTRIES, 'INSTALL')[0].path).toBe('/guide');
        expect(searchPages(ENTRIES, '')).toEqual([]);
        expect(searchPages(ENTRIES, '   ')).toEqual([]);
    });

    it('honors the limit option', () => {
        expect(searchPages(ENTRIES, 'install', { limit: 1 })).toHaveLength(1);
    });
});

describe('loadSearchIndex (#62)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches /search-index.json relative to the base', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ version: 1, entries: ENTRIES }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const entries = await loadSearchIndex({ base: '/sub/' });
        expect(fetchMock).toHaveBeenCalledWith('/sub/search-index.json');
        expect(entries).toHaveLength(3);
    });

    it('throws a descriptive error when the index is missing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
        await expect(loadSearchIndex()).rejects.toThrow(/search-index\.json.*search/s);
    });
});
