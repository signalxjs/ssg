/**
 * Nested collection paths (signalxjs/ssg#143): when one collection's `path`
 * is a string prefix of another's, the shorter collection over-assigned the
 * longer collection's pages — `'/modules/updates-ui/x'.startsWith('/modules/updates')`
 * is true, so `updates-docs` absorbed every `/modules/updates-ui/*` page. A
 * page belongs to a collection only on a path-segment boundary, and when
 * several collections match the longest path wins.
 */

import { describe, it, expect } from 'vitest';
import { generateAllCollections, detectCollection } from '../routing/navigation';
import { generateNavigationModule } from '../routing/virtual-navigation';
import type { SSGRoute, SSGConfig, CollectionConfig, NavSection } from '../types';

function route(path: string): SSGRoute {
    return { path, file: `${path}.mdx`, name: path, meta: { title: path } };
}

function hrefs(sidebar: NavSection[]): string[] {
    return sidebar
        .flatMap((section) => section.items.map((i) => i.href))
        .filter((h): h is string => h !== undefined)
        .sort();
}

describe('nested collection paths (#143)', () => {
    const ROUTES: SSGRoute[] = [
        route('/modules/updates/overview'),
        route('/modules/updates/changelog'),
        route('/modules/updates-ui/overview'),
        route('/modules/updates-ui/components'),
    ];

    const config = {
        collections: {
            'updates-docs': { path: '/modules/updates' },
            'updates-ui-docs': { path: '/modules/updates-ui' },
        },
    };

    it('does not leak a sibling collection into a prefix collection', () => {
        const nav = generateAllCollections(ROUTES, config, false);

        expect(hrefs(nav['updates-docs'].sidebar)).toEqual([
            '/modules/updates/changelog',
            '/modules/updates/overview',
        ]);
        expect(hrefs(nav['updates-ui-docs'].sidebar)).toEqual([
            '/modules/updates-ui/components',
            '/modules/updates-ui/overview',
        ]);
    });

    it('assigns a nested page to the longest matching collection only', () => {
        // /docs and /docs/api nest legitimately: a page under /docs/api
        // belongs to the api collection, not the broader docs one.
        const routes: SSGRoute[] = [
            route('/docs/intro'),
            route('/docs/api/router'),
        ];
        const nav = generateAllCollections(routes, {
            collections: { docs: { path: '/docs' }, api: { path: '/docs/api' } },
        }, false);

        expect(hrefs(nav.docs.sidebar)).toEqual(['/docs/intro']);
        expect(hrefs(nav.api.sidebar)).toEqual(['/docs/api/router']);
    });
});

describe('detectCollection (#143)', () => {
    const collections: Record<string, CollectionConfig> = {
        'updates-docs': { path: '/modules/updates' },
        'updates-ui-docs': { path: '/modules/updates-ui' },
    };

    it('matches the most specific collection on a segment boundary', () => {
        expect(detectCollection('/modules/updates/overview', collections)).toBe('updates-docs');
        expect(detectCollection('/modules/updates-ui/overview', collections)).toBe('updates-ui-docs');
    });

    it('does not match a path that only shares a prefix mid-segment', () => {
        // '/modules/updatesy' starts with '/modules/updates' but is not under it.
        expect(detectCollection('/modules/updatesy', collections)).toBeUndefined();
    });

    it('matches the collection root path itself', () => {
        expect(detectCollection('/modules/updates', collections)).toBe('updates-docs');
    });
});

describe('generated detectCollection (#143)', () => {
    // The virtual module ships its own copy of detectCollection as a string;
    // make sure the escaped boundary regex it emits is valid and behaves like
    // the source implementation.
    const config: SSGConfig = {
        collections: {
            'updates-docs': { path: '/modules/updates' },
            'updates-ui-docs': { path: '/modules/updates-ui/' },
        },
    };
    const code = generateNavigationModule([], config, false);
    // Pull the function body out of the generated ESM source and run it.
    const detect = new Function(
        `${code.replace(/export function/g, 'function').replace(/export const/g, 'const').replace(/export default[^;]+;/g, '')}; return detectCollection;`
    )() as (path: string) => string | undefined;

    it('matches the most specific collection on a segment boundary', () => {
        expect(detect('/modules/updates/overview')).toBe('updates-docs');
        // trailing slash in the config path must not break the boundary match
        expect(detect('/modules/updates-ui/overview')).toBe('updates-ui-docs');
    });

    it('does not match a path that only shares a prefix mid-segment', () => {
        expect(detect('/modules/updatesy')).toBeUndefined();
    });
});
