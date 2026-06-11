/**
 * Tests for sitemap generation. Regression coverage for signalxjs/ssg#41:
 * `<loc>` must match the URL static hosts serve with 200 (`/about/`, since
 * output is `about/index.html`), byte-identical with the canonical in head.ts.
 */

import { describe, it, expect } from 'vitest';
import { generateSitemap, type SitemapEntry } from '../sitemap';
import { generateHeadTags } from '../head';
import type { SSGConfig } from '../types';

const CONFIG: SSGConfig = {
    base: '/',
    site: { url: 'https://example.com' },
};

function locs(entries: SitemapEntry[], config: SSGConfig = CONFIG): string[] {
    const xml = generateSitemap(entries, config);
    return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
}

describe('generateSitemap — URL normalization (#41)', () => {
    it('emits trailing-slash URLs for folder routes', () => {
        expect(locs([{ path: '/about' }, { path: '/docs/guide' }])).toEqual([
            'https://example.com/about/',
            'https://example.com/docs/guide/',
        ]);
    });

    it('emits the root URL with a single trailing slash', () => {
        expect(locs([{ path: '/' }])).toEqual(['https://example.com/']);
    });

    it('leaves .html routes untouched', () => {
        expect(locs([{ path: '/foo.html' }])).toEqual(['https://example.com/foo.html']);
    });

    it('respects a base path', () => {
        expect(locs([{ path: '/about' }], { ...CONFIG, base: '/docs/' })).toEqual([
            'https://example.com/docs/about/',
        ]);
    });

    it("trailingSlash: 'never' preserves the old behavior", () => {
        expect(locs([{ path: '/about' }], { ...CONFIG, trailingSlash: 'never' })).toEqual([
            'https://example.com/about',
        ]);
    });

    it('is byte-identical with the canonical emitted by generateHeadTags', () => {
        const [loc] = locs([{ path: '/about' }]);
        const head = generateHeadTags({ path: '/about', route: { meta: {} } }, CONFIG);
        expect(head).toContain(`<link rel="canonical" href="${loc}">`);
        expect(head).toContain(`<meta property="og:url" content="${loc}">`);
    });
});

describe('sitemap plumbing (#56)', () => {
    const page = (path: string, meta?: Record<string, unknown>) => ({
        path,
        file: `/dist${path}/index.html`,
        time: 1,
        size: 100,
        meta,
    });

    it('excludes pages with robots noindex', async () => {
        const { pagesToSitemapEntries } = await import('../sitemap');
        const entries = pagesToSitemapEntries([
            page('/visible'),
            page('/hidden', { robots: 'noindex, nofollow' }),
        ] as any);
        expect(entries.map((e) => e.path)).toEqual(['/visible']);
    });

    it('excludes the 404 page', async () => {
        const { pagesToSitemapEntries } = await import('../sitemap');
        const entries = pagesToSitemapEntries([page('/'), page('/404')] as any);
        expect(entries.map((e) => e.path)).toEqual(['/']);
    });

    it('maps meta.date to lastmod', async () => {
        const { pagesToSitemapEntries, generateSitemap } = await import('../sitemap');
        const entries = pagesToSitemapEntries([
            page('/post', { date: new Date('2026-05-01T12:00:00Z') }),
        ] as any);
        const xml = generateSitemap(entries, { base: '/', site: { url: 'https://x.example' } });
        expect(xml).toContain('<lastmod>2026-05-01</lastmod>');
    });

    it('writeSitemap does not clobber an existing robots.txt', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { writeSitemap } = await import('../sitemap');

        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-robots-'));
        fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /secret\n');
        try {
            await writeSitemap([page('/')] as any, { base: '/', site: { url: 'https://x.example' } }, outDir);
            const robots = fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf-8');
            expect(robots).toContain('Disallow: /secret');
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });
});
