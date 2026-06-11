/**
 * Regression coverage for signalxjs/ssg#48: pages with `draft: true`
 * frontmatter must be excluded from production builds (and thereby from the
 * sitemap, which is generated from rendered pages) unless explicitly included
 * via the `drafts` build option.
 */

import { describe, it, expect } from 'vitest';
import { collectPaths } from '../collect-paths';
import type { SSGRoute } from '../types';

const ROUTES: SSGRoute[] = [
    { path: '/', file: '/site/src/pages/index.mdx', name: 'index', meta: { title: 'Home' } },
    { path: '/guide', file: '/site/src/pages/guide.mdx', name: 'guide', meta: { title: 'Guide' } },
    { path: '/wip', file: '/site/src/pages/wip.mdx', name: 'wip', meta: { title: 'WIP', draft: true } },
];

describe('collectPaths — draft exclusion (#48)', () => {
    it('excludes draft: true pages by default', async () => {
        const paths = await collectPaths(ROUTES, '/site', []);
        expect(paths.map((p) => p.path)).toEqual(['/', '/guide']);
    });

    it('includes draft pages when the drafts option is set', async () => {
        const paths = await collectPaths(ROUTES, '/site', [], { drafts: true });
        expect(paths.map((p) => p.path)).toEqual(['/', '/guide', '/wip']);
    });

    it('treats routes without meta as non-drafts', async () => {
        const paths = await collectPaths(
            [{ path: '/plain', file: '/site/src/pages/plain.tsx', name: 'plain' }],
            '/site',
            []
        );
        expect(paths.map((p) => p.path)).toEqual(['/plain']);
    });
});
