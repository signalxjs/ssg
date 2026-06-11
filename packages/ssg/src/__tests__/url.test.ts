/**
 * Tests for public-URL path normalization (signalxjs/ssg#41).
 *
 * Folder routes are emitted as `<path>/index.html`, so the URL a static host
 * serves with 200 is `/about/` — canonical/og:url/sitemap must say the same
 * or every declared URL is a 301.
 */

import { describe, it, expect } from 'vitest';
import { normalizePagePath } from '../url';

describe('normalizePagePath', () => {
    it('appends a trailing slash to folder routes by default', () => {
        expect(normalizePagePath('/about')).toBe('/about/');
        expect(normalizePagePath('/docs/guide')).toBe('/docs/guide/');
    });

    it('leaves the root path alone', () => {
        expect(normalizePagePath('/')).toBe('/');
    });

    it('leaves .html file routes alone', () => {
        expect(normalizePagePath('/foo.html')).toBe('/foo.html');
    });

    it('does not double a trailing slash that is already present', () => {
        expect(normalizePagePath('/about/')).toBe('/about/');
    });

    it("trailingSlash: 'never' strips the slash instead", () => {
        expect(normalizePagePath('/about', 'never')).toBe('/about');
        expect(normalizePagePath('/about/', 'never')).toBe('/about');
        expect(normalizePagePath('/', 'never')).toBe('/');
        expect(normalizePagePath('/foo.html', 'never')).toBe('/foo.html');
    });
});
