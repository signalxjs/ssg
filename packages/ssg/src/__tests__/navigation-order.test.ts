/**
 * Configurable sidebar category order (signalxjs/ssg#100): sites could only
 * reorder categories whose names happened to match the built-in map baked
 * into the package — custom categories all landed at weight 50,
 * alphabetically. Now `sectionOrder` accepts an explicit list (position =
 * order, listed before unlisted) and can be set per collection.
 */

import { describe, it, expect } from 'vitest';
import { generateAllCollections, normalizeSectionOrder } from '../routing/navigation';
import type { SSGRoute } from '../types';

function route(path: string, category: string, title: string): SSGRoute {
    return { path, file: `${path}.mdx`, name: title, meta: { title, category } };
}

const ROUTES: SSGRoute[] = [
    route('/docs/a', 'Navigators', 'A'),
    route('/docs/b', 'Screens', 'B'),
    route('/docs/c', 'Chrome', 'C'),
    route('/docs/d', 'Guides', 'D'), // in the built-in map (40)
];

function sidebarTitles(config: Parameters<typeof generateAllCollections>[1]): string[] {
    const nav = generateAllCollections(ROUTES, config, false);
    return nav.docs.sidebar.map((s) => s.title);
}

describe('normalizeSectionOrder (#100)', () => {
    it('turns a list into position weights', () => {
        expect(normalizeSectionOrder(['First', 'Second'])).toEqual({ First: 0, Second: 1 });
    });

    it('passes maps through and handles undefined', () => {
        expect(normalizeSectionOrder({ X: 30 })).toEqual({ X: 30 });
        expect(normalizeSectionOrder(undefined)).toBeUndefined();
    });
});

describe('sectionOrder list form (#100)', () => {
    it('orders categories by list position, listed before unlisted', () => {
        const titles = sidebarTitles({
            collections: { docs: { path: '/docs' } },
            navigation: { sectionOrder: ['Screens', 'Navigators', 'Chrome'] },
        });
        // The three listed come first in list order; 'Guides' (unlisted,
        // built-in weight 40) follows.
        expect(titles).toEqual(['Screens', 'Navigators', 'Chrome', 'Guides']);
    });

    it('map form still works', () => {
        const titles = sidebarTitles({
            collections: { docs: { path: '/docs' } },
            navigation: { sectionOrder: { Chrome: 1, Screens: 2, Navigators: 3 } },
        });
        expect(titles).toEqual(['Chrome', 'Screens', 'Navigators', 'Guides']);
    });
});

describe('per-collection sectionOrder (#100)', () => {
    it('a collection override wins over the site-wide setting', () => {
        const titles = sidebarTitles({
            collections: { docs: { path: '/docs', sectionOrder: ['Chrome', 'Screens', 'Navigators'] } },
            navigation: { sectionOrder: ['Screens', 'Navigators', 'Chrome'] },
        });
        expect(titles).toEqual(['Chrome', 'Screens', 'Navigators', 'Guides']);
    });
});
