/**
 * Regression coverage for signalxjs/ssg#46: dynamic routes never built —
 * getStaticPaths was loaded by import()ing the raw .tsx/.mdx source file,
 * which Node cannot do (ERR_UNKNOWN_FILE_EXTENSION), and the failure was
 * swallowed into a warning. The build now resolves getStaticPaths from the
 * built SSR bundle via a loader injected into collectPaths.
 */

import { describe, it, expect } from 'vitest';
import { collectPaths } from '../collect-paths';
import type { SSGRoute } from '../types';

const DYNAMIC_ROUTE: SSGRoute = {
    path: '/blog/:slug',
    file: '/site/src/pages/blog/[slug].tsx',
    name: 'blog-slug',
};

describe('collectPaths — dynamic routes via SSR bundle loader (#46)', () => {
    it('expands dynamic routes using the injected loadStaticPaths', async () => {
        const warnings: string[] = [];
        const paths = await collectPaths([DYNAMIC_ROUTE], '/site', warnings, {
            loadStaticPaths: async () => [
                { params: { slug: 'hello' }, props: { n: 1 } },
                { params: { slug: 'world' } },
            ],
        });

        expect(paths.map((p) => p.path)).toEqual(['/blog/hello', '/blog/world']);
        expect(paths[0].params).toEqual({ slug: 'hello' });
        expect(paths[0].props).toEqual({ n: 1 });
        expect(warnings).toEqual([]);
    });

    it('warns and skips when the bundle has no getStaticPaths for the route', async () => {
        const warnings: string[] = [];
        const paths = await collectPaths([DYNAMIC_ROUTE], '/site', warnings, {
            loadStaticPaths: async () => null,
        });

        expect(paths).toEqual([]);
        expect(warnings.join('\n')).toContain('getStaticPaths');
    });

    it('fails the build when getStaticPaths throws (no silent skip)', async () => {
        const promise = collectPaths([DYNAMIC_ROUTE], '/site', [], {
            loadStaticPaths: async () => {
                throw new Error('boom from getStaticPaths');
            },
        });

        await expect(promise).rejects.toThrow(/getStaticPaths for dynamic route \/blog\/:slug/);
        await promise.catch((err) => {
            expect(err.file).toBe(DYNAMIC_ROUTE.file);
            expect(String(err.cause)).toContain('boom from getStaticPaths');
        });
    });

    it('leaves static routes untouched', async () => {
        const paths = await collectPaths(
            [{ path: '/about', file: '/site/src/pages/about.tsx', name: 'about' }],
            '/site',
            [],
            { loadStaticPaths: async () => null }
        );
        expect(paths.map((p) => p.path)).toEqual(['/about']);
    });
});
