/**
 * Redirects config (signalxjs/ssg#61): `redirects: { from: to }` emits a
 * static meta-refresh page per entry plus a `_redirects` file for hosts
 * that support it (Netlify/Cloudflare). Evidence of need: the docs site
 * generates client-side redirect stub pages for every module root
 * (signalxjs.github.io#64 / generate-module-docs.mjs).
 */

import { describe, it, expect } from 'vitest';
import { generateRedirectHtml, generateRedirectsFile, writeRedirects } from '../redirects';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('generateRedirectHtml (#61)', () => {
    it('emits a meta-refresh page with canonical and fallback link', () => {
        const html = generateRedirectHtml('/new-page/', { site: { url: 'https://x.example' }, base: '/' });
        expect(html).toContain('<meta http-equiv="refresh" content="0; url=/new-page/">');
        expect(html).toContain('<link rel="canonical" href="https://x.example/new-page/">');
        expect(html).toContain('<a href="/new-page/">');
        expect(html).toContain('<meta name="robots" content="noindex">');
    });

    it('escapes HTML in the target', () => {
        const html = generateRedirectHtml('/a"><script>x</script>', { base: '/' });
        expect(html).not.toContain('<script>x</script>');
    });

    it('prefixes the base for relative targets', () => {
        const html = generateRedirectHtml('/docs/intro/', { base: '/sub/' });
        expect(html).toContain('url=/sub/docs/intro/');
    });

    it('leaves absolute URL targets untouched', () => {
        const html = generateRedirectHtml('https://elsewhere.example/x', { base: '/sub/' });
        expect(html).toContain('url=https://elsewhere.example/x');
    });

    it('treats non-//-scheme URLs (mailto:, tel:) as absolute', () => {
        const html = generateRedirectHtml('mailto:hi@example.com', { base: '/sub/' });
        expect(html).toContain('url=mailto:hi@example.com');
        expect(html).not.toContain('/sub/mailto:');
    });

    it('does not double-prefix a target that already carries the base', () => {
        const html = generateRedirectHtml('/sub/docs/intro/', { base: '/sub/' });
        expect(html).toContain('url=/sub/docs/intro/');
        expect(html).not.toContain('/sub/sub/');
    });

    it('still prefixes paths that merely start with the base string', () => {
        const html = generateRedirectHtml('/subway/', { base: '/sub/' });
        expect(html).toContain('url=/sub/subway/');
    });
});

describe('generateRedirectsFile (#61)', () => {
    it('emits one 301 line per redirect in Netlify format', () => {
        const text = generateRedirectsFile({ '/old': '/new/', '/blog/old-post': '/blog/new-post/' }, { base: '/' });
        expect(text.trim().split('\n')).toEqual([
            '/old /new/ 301',
            '/blog/old-post /blog/new-post/ 301',
        ]);
    });

    it('applies the base to both sides for relative paths', () => {
        const text = generateRedirectsFile({ '/old': '/new/' }, { base: '/sub/' });
        expect(text).toContain('/sub/old /sub/new/ 301');
    });
});

describe('writeRedirects (#61)', () => {
    it('writes a redirect page per entry plus _redirects', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-redir-'));
        try {
            await writeRedirects(
                { '/old': '/new/', '/legacy/deep': '/docs/intro/' },
                { site: { url: 'https://x.example' }, base: '/' },
                outDir
            );
            expect(fs.readFileSync(path.join(outDir, 'old', 'index.html'), 'utf-8')).toContain('url=/new/');
            expect(fs.readFileSync(path.join(outDir, 'legacy', 'deep', 'index.html'), 'utf-8')).toContain('url=/docs/intro/');
            expect(fs.readFileSync(path.join(outDir, '_redirects'), 'utf-8')).toContain('/old /new/ 301');
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    it('appends to a user-managed _redirects instead of clobbering it', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-redir3-'));
        try {
            fs.writeFileSync(path.join(outDir, '_redirects'), '/user-rule /kept/ 302\n');
            await writeRedirects({ '/old': '/new/' }, { base: '/' }, outDir);
            const text = fs.readFileSync(path.join(outDir, '_redirects'), 'utf-8');
            // User rules stay first — Netlify is first-match-wins.
            expect(text.trim().split('\n')).toEqual(['/user-rule /kept/ 302', '/old /new/ 301']);
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    it('refuses to overwrite a real rendered page', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-redir2-'));
        try {
            fs.mkdirSync(path.join(outDir, 'about'), { recursive: true });
            fs.writeFileSync(path.join(outDir, 'about', 'index.html'), 'real page');
            await expect(
                writeRedirects({ '/about': '/elsewhere/' }, { base: '/' }, outDir)
            ).rejects.toThrow(/about/);
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    it('guards against pages rendered THIS run, not stale files from a previous build (#120)', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-redir3-'));
        try {
            // A previous build left this redirect page behind (outDir is not
            // cleaned between builds — the template lives there).
            fs.mkdirSync(path.join(outDir, 'old-guide'), { recursive: true });
            fs.writeFileSync(path.join(outDir, 'old-guide', 'index.html'), 'stale redirect page');

            // Rendered paths this run do NOT include /old-guide → overwrite is ours, allowed.
            await writeRedirects({ '/old-guide': '/guide/' }, { base: '/' }, outDir, ['/guide', '/']);
            expect(fs.readFileSync(path.join(outDir, 'old-guide', 'index.html'), 'utf-8')).toContain('url=/guide/');

            // A redirect shadowing a page rendered THIS run still fails loudly.
            await expect(
                writeRedirects({ '/guide': '/elsewhere/' }, { base: '/' }, outDir, ['/guide', '/'])
            ).rejects.toThrow(/guide/);
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });
});
