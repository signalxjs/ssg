/**
 * Tests for the generated virtual:ssg-routes module (signalxjs/ssg#46).
 *
 * Dynamic routes are rendered from the built SSR bundle, so the bundle must
 * carry each page's getStaticPaths — the build cannot import() raw .tsx/.mdx
 * source files from Node.
 */

import { describe, it, expect } from 'vitest';
import { generateRoutesModule } from '../virtual';
import type { SSGRoute, SSGConfig } from '../../types';

const CONFIG: SSGConfig = { defaultLayout: 'default' };

const ROUTES: SSGRoute[] = [
    { path: '/', file: '/site/src/pages/index.tsx', name: 'index' },
    { path: '/blog/:slug', file: '/site/src/pages/blog/[slug].tsx', name: 'blog-slug' },
];

describe('generateRoutesModule — getStaticPaths exposure (#46)', () => {
    it('forwards each page module getStaticPaths into the route definition', () => {
        const code = generateRoutesModule(ROUTES, CONFIG);
        // One wiring line per route, reading the named export off the module
        const occurrences = code.match(/getStaticPaths/g) || [];
        expect(occurrences.length).toBeGreaterThanOrEqual(ROUTES.length);
        expect(code).toContain("'getStaticPaths' in Page1Module");
    });

    it('guards the wiring behind import.meta.env.SSR so client bundles tree-shake it', () => {
        const code = generateRoutesModule(ROUTES, CONFIG);
        expect(code).toContain("getStaticPaths: import.meta.env.SSR && 'getStaticPaths' in Page1Module");
    });

    it('still emits path/file/component fields', () => {
        const code = generateRoutesModule(ROUTES, CONFIG);
        expect(code).toContain("path: '/blog/:slug'");
        expect(code).toContain("file: '/site/src/pages/blog/[slug].tsx'");
    });
});
