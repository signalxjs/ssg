/**
 * Tests for the file-based route scanner (pure functions).
 *
 * Regression coverage for signalxjs/ssg#50:
 * - `[[id]]` optional segments parsed as `:[id]` (the `[id]` branch matched first)
 * - `expandDynamicRoute` leaving the `?` optional marker in expanded paths
 * - param-name prefix collisions corrupting expanded paths
 */

import { describe, it, expect } from 'vitest';
import { filePathToRoutePath, expandDynamicRoute, fileToRoute } from '../scanner';
import type { SSGRoute } from '../../types';

function route(path: string): SSGRoute {
    return { path, file: '/fake/file.tsx', name: 'test' };
}

describe('filePathToRoutePath', () => {
    it('converts static segments unchanged', () => {
        expect(filePathToRoutePath('docs/getting-started')).toBe('docs/getting-started');
    });

    it('converts [id] to :id', () => {
        expect(filePathToRoutePath('users/[id]')).toBe('users/:id');
    });

    it('converts [id] in the middle of a path', () => {
        expect(filePathToRoutePath('users/[id]/posts')).toBe('users/:id/posts');
    });

    it('converts [...path] to *path', () => {
        expect(filePathToRoutePath('docs/[...path]')).toBe('docs/*path');
    });

    it('converts [[...slug]] to *slug', () => {
        expect(filePathToRoutePath('docs/[[...slug]]')).toBe('docs/*slug');
    });

    it('converts optional [[id]] to :id?', () => {
        expect(filePathToRoutePath('users/[[id]]')).toBe('users/:id?');
    });
});

describe('expandDynamicRoute', () => {
    it('expands a single dynamic param', () => {
        expect(expandDynamicRoute(route('/blog/:slug'), [{ params: { slug: 'hello' } }]))
            .toEqual(['/blog/hello']);
    });

    it('expands multiple paths', () => {
        expect(expandDynamicRoute(route('/blog/:slug'), [
            { params: { slug: 'a' } },
            { params: { slug: 'b' } },
        ])).toEqual(['/blog/a', '/blog/b']);
    });

    it('expands catch-all params, preserving slashes in the value', () => {
        expect(expandDynamicRoute(route('/docs/*path'), [{ params: { path: 'guide/intro' } }]))
            .toEqual(['/docs/guide/intro']);
    });

    it('strips the optional marker when an optional param has a value', () => {
        expect(expandDynamicRoute(route('/users/:id?'), [{ params: { id: 'x' } }]))
            .toEqual(['/users/x']);
    });

    it('drops the segment when an optional param has no value', () => {
        expect(expandDynamicRoute(route('/users/:id?'), [{ params: {} }]))
            .toEqual(['/users']);
    });

    it('yields / when the only segment is an absent optional param', () => {
        expect(expandDynamicRoute(route('/:lang?'), [{ params: {} }]))
            .toEqual(['/']);
    });

    it('is immune to param-name prefix collisions regardless of params order', () => {
        expect(expandDynamicRoute(route('/:id2/:id'), [{ params: { id: 'b', id2: 'a' } }]))
            .toEqual(['/a/b']);
        expect(expandDynamicRoute(route('/:id2/:id'), [{ params: { id2: 'a', id: 'b' } }]))
            .toEqual(['/a/b']);
    });

    it('expands mixed static, dynamic, and optional segments', () => {
        expect(expandDynamicRoute(route('/docs/:section/:page?'), [
            { params: { section: 'router', page: 'api' } },
            { params: { section: 'router' } },
        ])).toEqual(['/docs/router/api', '/docs/router']);
    });
});

describe('fileToRoute', () => {
    it('routes index files to /', () => {
        expect(fileToRoute('index.tsx', '/pages')?.path).toBe('/');
    });

    it('routes optional-segment files with the :id? pattern', () => {
        expect(fileToRoute('users/[[id]].tsx', '/pages')?.path).toBe('/users/:id?');
    });

    it('routes nested index files to the folder path', () => {
        expect(fileToRoute('docs/index.tsx', '/pages')?.path).toBe('/docs');
    });
});

describe('scanPages — TSX meta extraction (#205)', () => {
    it('populates route.meta from export const meta in .tsx pages', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { scanPages } = await import('../scanner');

        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-scan-tsx-'));
        fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'pages', 'cli.tsx'),
            `export const meta = {\n` +
                `    title: 'SignalX CLI - Scaffold & manage projects',\n` +
                `    description: 'Project scaffolding and platform commands.',\n` +
                `    layout: 'package',\n` +
                `    draft: true,\n` +
                `};\n` +
                `export default function Page() { return <div>cli</div>; }\n`
        );
        fs.writeFileSync(
            path.join(root, 'src', 'pages', 'plain.tsx'),
            `export default function Page() { return <div>plain</div>; }\n`
        );

        try {
            const routes = await scanPages({}, root);
            const cli = routes.find((r) => r.name === 'cli');
            const plain = routes.find((r) => r.name === 'plain');
            expect(cli?.meta?.title).toBe('SignalX CLI - Scaffold & manage projects');
            expect(cli?.meta?.description).toBe('Project scaffolding and platform commands.');
            expect(cli?.meta?.layout).toBe('package');
            expect(cli?.meta?.draft).toBe(true);
            expect(plain?.meta?.title).toBeUndefined();
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('leaves route.meta unset for non-analyzable TSX meta', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { scanPages } = await import('../scanner');

        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-scan-tsx-'));
        fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'pages', 'dynamic.tsx'),
            `import { SITE } from '../lib/site';\n` +
                `export const meta = { title: SITE.name };\n` +
                `export default function Page() { return <div />; }\n`
        );

        try {
            const routes = await scanPages({}, root);
            const dynamic = routes.find((r) => r.name === 'dynamic');
            expect(dynamic).toBeDefined();
            expect(dynamic?.meta?.title).toBeUndefined();
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('scanPages — H1 title fallback (#55)', () => {
    it('falls back to the first H1 when frontmatter has no title', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { scanPages } = await import('../scanner');

        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-scan-'));
        fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'pages', 'doc.mdx'),
            '---\ndescription: No title here\n---\n\n# Heading Title\n\nbody\n'
        );
        fs.writeFileSync(
            path.join(root, 'src', 'pages', 'titled.mdx'),
            '---\ntitle: Frontmatter Wins\n---\n\n# Ignored\n'
        );

        try {
            const routes = await scanPages({}, root);
            const doc = routes.find((r) => r.name === 'doc');
            const titled = routes.find((r) => r.name === 'titled');
            expect(doc?.meta?.title).toBe('Heading Title');
            expect(titled?.meta?.title).toBe('Frontmatter Wins');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
