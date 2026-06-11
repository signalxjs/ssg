/**
 * Theme parity helpers (signalxjs/ssg#65): no-FOUC theme init, prev/next
 * navigation links, and TOC heading collection (levels + data-toc-ignore).
 */

import { describe, it, expect } from 'vitest';
import { resolveInitialTheme, themeInitScript, THEME_STORAGE_KEY } from '../lib/theme-init';
import { prevNextLinks } from '../lib/prev-next';
import { collectTocItems } from '../components/TOC';

describe('theme init (#65)', () => {
    it('uses the persisted theme when valid', () => {
        expect(resolveInitialTheme('dark', false)).toBe('dark');
        expect(resolveInitialTheme('light', true)).toBe('light');
    });

    it('falls back to prefers-color-scheme, then light', () => {
        expect(resolveInitialTheme(null, true)).toBe('dark');
        expect(resolveInitialTheme(null, false)).toBe('light');
        expect(resolveInitialTheme('bogus', true)).toBe('dark');
    });

    it('emits an inline script that sets data-theme before paint', () => {
        const script = themeInitScript();
        expect(script).toContain(THEME_STORAGE_KEY);
        expect(script).toContain('data-theme');
        expect(script).toContain('prefers-color-scheme');
    });
});

const SECTIONS = [
    {
        title: 'Guide',
        items: [
            { title: 'Intro', href: '/docs/intro' },
            { title: 'Install', href: '/docs/install', items: [{ title: 'Deep', href: '/docs/install/deep' }] },
        ],
    },
    { title: 'API', items: [{ title: 'Config', href: '/docs/config' }] },
];

describe('prevNextLinks (#65)', () => {
    it('returns neighbors in flattened sidebar order, across sections and nesting', () => {
        const { prev, next } = prevNextLinks(SECTIONS, '/docs/install');
        expect(prev).toMatchObject({ title: 'Intro', href: '/docs/intro' });
        expect(next).toMatchObject({ title: 'Deep', href: '/docs/install/deep' });
    });

    it('crosses section boundaries', () => {
        const { next } = prevNextLinks(SECTIONS, '/docs/install/deep');
        expect(next).toMatchObject({ title: 'Config', href: '/docs/config' });
    });

    it('is trailing-slash-insensitive and handles the ends', () => {
        expect(prevNextLinks(SECTIONS, '/docs/intro/').prev).toBeNull();
        expect(prevNextLinks(SECTIONS, '/docs/config').next).toBeNull();
        expect(prevNextLinks(SECTIONS, '/not-there')).toEqual({ prev: null, next: null });
    });
});

describe('collectTocItems (#65)', () => {
    function article(html: string): HTMLElement {
        const el = document.createElement('article');
        el.innerHTML = html;
        return el;
    }

    it('collects headings within the configured levels', () => {
        const root = article('<h2 id="a">A</h2><h3 id="b">B</h3><h4 id="c">C</h4>');
        expect(collectTocItems(root, 2, 3).map((i) => i.id)).toEqual(['a', 'b']);
        expect(collectTocItems(root, 2, 4).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('skips headings marked data-toc-ignore', () => {
        const root = article('<h2 id="a">A</h2><h2 id="skip" data-toc-ignore>Skip</h2>');
        expect(collectTocItems(root, 2, 3).map((i) => i.id)).toEqual(['a']);
    });

    it('strips the autolink anchor from the text', () => {
        const root = article('<h2 id="a">Title<a class="heading-anchor">#</a></h2>');
        expect(collectTocItems(root, 2, 3)[0].text).toBe('Title');
    });
});
