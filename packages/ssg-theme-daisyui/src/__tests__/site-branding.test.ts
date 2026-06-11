/**
 * Regression coverage for signalxjs/ssg#60: the theme hardcoded SignalX
 * branding (name, nav links, repo URL). Branding must come from site config
 * with neutral fallbacks.
 */

import { describe, it, expect } from 'vitest';
import { siteBrand, siteNavItems, siteRepoUrl } from '../lib/site';

describe('theme site-branding helpers (#60)', () => {
    it('brand comes from site.title with a neutral fallback', () => {
        expect(siteBrand({ title: 'My Project' })).toBe('My Project');
        expect(siteBrand(undefined)).toBe('Site');
        expect(siteBrand({})).toBe('Site');
    });

    it('nav comes from site.nav, defaulting to none (no hardcoded /docs)', () => {
        expect(siteNavItems({ nav: [{ title: 'Guide', href: '/guide' }] })).toEqual([
            { title: 'Guide', href: '/guide' },
        ]);
        expect(siteNavItems({})).toEqual([]);
        expect(siteNavItems(undefined)).toEqual([]);
    });

    it('repo link is omitted unless configured (no hardcoded signalxjs/core)', () => {
        expect(siteRepoUrl({ repo: 'https://github.com/me/mine' })).toBe('https://github.com/me/mine');
        expect(siteRepoUrl({})).toBeNull();
        expect(siteRepoUrl(undefined)).toBeNull();
    });
});
