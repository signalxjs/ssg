/**
 * Programmatic routes (signalxjs/ssg#59): `config.routes` adds pages that
 * don't come from the filesystem scan — CMS-backed pages, tag archives,
 * generated docs. Evidence of need: the docs site's 254-line
 * generate-module-docs.mjs scaffolds MDX stubs because routes could only
 * come from files in the pages dir.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanPages } from '../routing/scanner';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let root: string;

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-proutes-'));
    fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'templates'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'pages', 'index.tsx'), 'export default () => null;');
    fs.writeFileSync(path.join(root, 'src', 'templates', 'tag.tsx'), 'export default () => null;');
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('config.routes (#59)', () => {
    it('merges programmatic routes with scanned ones', async () => {
        const routes = await scanPages(
            {
                routes: ({ root: r }) => [
                    {
                        path: '/tags/sigx',
                        file: path.join(r, 'src', 'templates', 'tag.tsx'),
                        meta: { title: 'Tag: sigx' },
                    },
                ],
            },
            root
        );
        const tag = routes.find((r) => r.path === '/tags/sigx');
        expect(tag).toBeDefined();
        expect(tag!.meta?.title).toBe('Tag: sigx');
        expect(tag!.name).toBeTruthy();
        // Scanned route still present.
        expect(routes.some((r) => r.path === '/')).toBe(true);
    });

    it('resolves relative file paths against root and supports async fns', async () => {
        const routes = await scanPages(
            {
                routes: async () => [{ path: '/rel', file: 'src/templates/tag.tsx' }],
            },
            root
        );
        const rel = routes.find((r) => r.path === '/rel');
        expect(rel).toBeDefined();
        expect(path.isAbsolute(rel!.file)).toBe(true);
        expect(fs.existsSync(rel!.file)).toBe(true);
    });

    it('rejects a programmatic route whose file does not exist', async () => {
        await expect(
            scanPages({ routes: () => [{ path: '/x', file: 'src/templates/missing.tsx' }] }, root)
        ).rejects.toThrow(/missing\.tsx/);
    });

    it('rejects a path collision with a scanned page', async () => {
        await expect(
            scanPages({ routes: () => [{ path: '/', file: 'src/templates/tag.tsx' }] }, root)
        ).rejects.toThrow(/collide|already/i);
    });

    it('rejects paths not starting with /', async () => {
        await expect(
            scanPages({ routes: () => [{ path: 'tags/x', file: 'src/templates/tag.tsx' }] }, root)
        ).rejects.toThrow(/start with/);
    });
});
