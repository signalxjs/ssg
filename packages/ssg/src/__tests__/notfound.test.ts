/**
 * Regression coverage for signalxjs/ssg#57 — the 404 story:
 *
 * 1. A `src/pages/404.*` page was emitted as `404/index.html`, which no
 *    static host uses — GitHub Pages/Netlify/Cloudflare serve a ROOT
 *    `404.html`. The output mapping must special-case it.
 * 2. The dev server served the SPA shell with HTTP 200 for ANY
 *    extension-less URL — a typo'd URL looked like a blank, successful page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getOutputPath } from '../collect-paths';
import { ssgPlugin } from '../vite/plugin';

describe('getOutputPath — root 404.html (#57)', () => {
    it('maps the /404 route to a root 404.html', () => {
        expect(getOutputPath('/404', '/dist')).toBe(path.join('/dist', '404.html'));
    });

    it('maps normal folder routes unchanged', () => {
        expect(getOutputPath('/', '/dist')).toBe(path.join('/dist', 'index.html'));
        expect(getOutputPath('/about', '/dist')).toBe(path.join('/dist', 'about', 'index.html'));
        expect(getOutputPath('/foo.html', '/dist')).toBe(path.join('/dist', 'foo.html'));
    });

    it('does not special-case nested 404-ish paths', () => {
        expect(getOutputPath('/docs/404', '/dist')).toBe(path.join('/dist', 'docs', '404', 'index.html'));
    });
});

describe('dev middleware — unknown routes get a 404 status (#57)', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-404-'));
        fs.mkdirSync(path.join(root, 'src', 'pages', 'blog'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'pages', 'index.mdx'), '# Home\n');
        fs.writeFileSync(path.join(root, 'src', 'pages', 'guide.mdx'), '# Guide\n');
        fs.writeFileSync(path.join(root, 'src', 'pages', 'blog', '[slug].mdx'), '# Post\n');
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    async function serve(url: string): Promise<{ statusCode: number }> {
        const [main] = ssgPlugin();
        await (main as any).configResolved({ command: 'serve', root, base: '/' });

        let middleware: any;
        const devServer = {
            watcher: { on: vi.fn() },
            moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
            ws: { send: vi.fn() },
            middlewares: { use: (fn: any) => { middleware = fn; } },
            transformIndexHtml: vi.fn(async (_url: string, html: string) => html),
        };
        (main as any).configureServer(devServer);
        expect(middleware).toBeDefined();

        const res: any = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
        await new Promise<void>((resolve) => {
            res.end = vi.fn(() => resolve());
            middleware({ url }, res, () => resolve());
        });
        return res;
    }

    it('serves known static routes with 200', async () => {
        expect((await serve('/guide')).statusCode).toBe(200);
        expect((await serve('/')).statusCode).toBe(200);
    });

    it('serves matching dynamic routes with 200', async () => {
        expect((await serve('/blog/anything')).statusCode).toBe(200);
    });

    it('serves unknown routes with 404', async () => {
        expect((await serve('/no-such-page')).statusCode).toBe(404);
        expect((await serve('/blog/a/b/c')).statusCode).toBe(404);
    });
});
