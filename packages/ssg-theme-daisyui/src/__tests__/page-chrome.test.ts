/**
 * Per-page chrome helpers (signalxjs/ssg#65): edit links, breadcrumbs,
 * last-updated, announcement dismissal keys.
 */

import { describe, it, expect } from 'vitest';
import { editUrl, breadcrumbs, lastUpdated, announcementKey } from '../lib/page-chrome';

describe('editUrl (#65)', () => {
    it('joins editBase and sourceFile with exactly one slash', () => {
        expect(
            editUrl({ editBase: 'https://github.com/o/r/edit/main/' }, { sourceFile: 'src/pages/a.mdx' })
        ).toBe('https://github.com/o/r/edit/main/src/pages/a.mdx');
        expect(
            editUrl({ editBase: 'https://github.com/o/r/edit/main' }, { sourceFile: '/src/pages/a.mdx' })
        ).toBe('https://github.com/o/r/edit/main/src/pages/a.mdx');
    });

    it('returns null without editBase or sourceFile', () => {
        expect(editUrl({ editBase: 'x' }, {})).toBeNull();
        expect(editUrl({}, { sourceFile: 'a.mdx' })).toBeNull();
        expect(editUrl(undefined, undefined)).toBeNull();
    });
});

describe('breadcrumbs (#65)', () => {
    const SECTIONS = [
        {
            title: 'Guide',
            items: [
                { title: 'Intro', href: '/docs/intro' },
                { title: 'Install', href: '/docs/install', items: [{ title: 'Deep', href: '/docs/install/deep' }] },
            ],
        },
    ];

    it('builds section → ancestors → page', () => {
        expect(breadcrumbs(SECTIONS, '/docs/install/deep')).toEqual([
            { title: 'Guide' },
            { title: 'Install', href: '/docs/install' },
            { title: 'Deep', href: '/docs/install/deep' },
        ]);
    });

    it('is trailing-slash insensitive and empty for unknown pages', () => {
        expect(breadcrumbs(SECTIONS, '/docs/intro/')).toHaveLength(2);
        expect(breadcrumbs(SECTIONS, '/nope')).toEqual([]);
    });
});

describe('lastUpdated (#65)', () => {
    it('prefers updated over date and parses strings', () => {
        expect(lastUpdated({ updated: '2026-06-01', date: '2026-01-01' } as never)?.toISOString()).toContain(
            '2026-06-01'
        );
        expect(lastUpdated({ date: '2026-01-01' } as never)?.toISOString()).toContain('2026-01-01');
    });

    it('returns null for missing or invalid dates', () => {
        expect(lastUpdated({})).toBeNull();
        expect(lastUpdated({ date: 'not a date' } as never)).toBeNull();
    });
});

describe('announcementKey (#65)', () => {
    it('is keyed by id when present, else by the text', () => {
        expect(announcementKey({ id: 'v2', text: 'x' })).toBe('sigx-announcement-v2');
        expect(announcementKey({ text: 'Big news here' })).toBe('sigx-announcement-Big news here');
    });
});
