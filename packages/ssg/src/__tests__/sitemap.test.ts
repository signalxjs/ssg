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
