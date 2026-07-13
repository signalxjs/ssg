/**
 * LLM-friendly outputs (signalxjs/ssg#176): llms.txt index, llms-full.txt,
 * per-page .md renditions, per-area sub-indexes. Visibility follows the
 * sitemap (noindex/404 excluded), plus `exclude` globs, frontmatter
 * `llms: false`, and the transform's null-drop.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    prepareLlmsPages,
    buildLlmsIndex,
    buildLlmsFullText,
    getMarkdownPath,
    writeLlmsOutputs,
    type LlmsPage,
} from '../llms';
import type { PageBuildResult, SSGConfig } from '../types';

const CONFIG: SSGConfig = {
    site: { title: 'My Site', description: 'A test site', url: 'https://example.com' },
    collections: {
        docs: { path: '/docs' },
        blog: { path: '/blog' },
    },
};

function page(p: string, meta: Record<string, unknown> = {}, source = `src/pages${p === '/' ? '/index' : p}.mdx`): PageBuildResult {
    return { path: p, file: `${p}/index.html`, time: 1, size: 100, meta, source };
}

/** Sources keyed by `page.source`; prepare() reads through this instead of fs. */
function reader(sources: Record<string, string>) {
    return (file: string) => Promise.resolve(sources[file] ?? `---\ntitle: T\n---\n\nBody of ${file}\n`);
}

const READ = reader({});

describe('getMarkdownPath (#176)', () => {
    it('maps routes to .md siblings of the HTML output', () => {
        expect(getMarkdownPath('/')).toBe('index.md');
        expect(getMarkdownPath('/docs/guide')).toBe('docs/guide.md');
        expect(getMarkdownPath('/docs/guide/')).toBe('docs/guide.md');
        expect(getMarkdownPath('/foo.html')).toBe('foo.md');
    });
});

describe('prepareLlmsPages (#176)', () => {
    it('excludes noindex and 404 pages, like the sitemap', async () => {
        const pages = await prepareLlmsPages(
            [page('/a'), page('/hidden', { robots: 'noindex, nofollow' }), page('/404')],
            CONFIG,
            {},
            READ
        );
        expect(pages.map((lp) => lp.page.path)).toEqual(['/a']);
    });

    it('applies exclude globs and frontmatter llms:false', async () => {
        const pages = await prepareLlmsPages(
            [page('/a'), page('/internal/x'), page('/optout', { llms: false })],
            CONFIG,
            { exclude: ['/internal/*'] },
            READ
        );
        expect(pages.map((lp) => lp.page.path)).toEqual(['/a']);
    });

    it('renders a rendition for markdown sources only', async () => {
        const pages = await prepareLlmsPages(
            [page('/a'), page('/app', {}, 'src/pages/app.tsx')],
            CONFIG,
            {},
            READ
        );
        const [a, app] = pages;
        expect(a.mdPath).toBe('a.md');
        expect(a.markdown).toContain('url: https://example.com/a/');
        expect(app.mdPath).toBeUndefined();
        expect(app.markdown).toBeUndefined();
    });

    it('skips renditions for dynamic mdx routes (shared source)', async () => {
        const pages = await prepareLlmsPages(
            [page('/blog/first', {}, 'src/pages/blog/[slug].mdx')],
            CONFIG,
            {},
            READ
        );
        expect(pages[0].mdPath).toBeUndefined();
    });

    it('detects dynamic segments in directory names too', async () => {
        // users/[id]/index.mdx — the bracket segment is a directory, not the
        // basename; its expansions still share one source.
        const pages = await prepareLlmsPages(
            [
                page('/users/1/posts', {}, 'src/pages/users/[id]/posts.mdx'),
                page('/users/2', {}, 'src\\pages\\users\\[id]\\index.mdx'),
            ],
            CONFIG,
            {},
            READ
        );
        expect(pages[0].mdPath).toBeUndefined();
        expect(pages[1].mdPath).toBeUndefined();
    });

    it('derives urls with base and trailingSlash, like the sitemap (#41)', async () => {
        const config: SSGConfig = { ...CONFIG, base: '/site/', trailingSlash: 'never' };
        const pages = await prepareLlmsPages([page('/docs/guide')], config, {}, READ);
        expect(pages[0].url).toBe('https://example.com/site/docs/guide');
    });

    it('lets transform rewrite a rendition or drop the page from everything', async () => {
        const pages = await prepareLlmsPages(
            [page('/keep'), page('/drop')],
            CONFIG,
            {
                transform: (md, p) => (p.path === '/drop' ? null : `${md}\nEXTRA\n`),
            },
            READ
        );
        expect(pages.map((lp) => lp.page.path)).toEqual(['/keep']);
        expect(pages[0].markdown).toContain('EXTRA');
    });
});

function llmsPage(p: string, meta: Record<string, unknown> = {}, markdown?: string): LlmsPage {
    const built = page(p, meta);
    return {
        page: built,
        url: `https://example.com${p === '/' ? '/' : `${p}/`}`,
        ...(markdown !== undefined
            ? { markdown, mdPath: getMarkdownPath(p) }
            : {}),
    };
}

const md = (p: string) => `---\nurl: https://example.com${p}/\n---\n\nBody of ${p}\n`;

describe('buildLlmsIndex (#176)', () => {
    const PAGES: LlmsPage[] = [
        llmsPage('/', { title: 'Home' }, md('/')),
        llmsPage('/docs/setup', { title: 'Setup', description: 'Install it', category: 'Basics', order: 2 }, md('/docs/setup')),
        llmsPage('/docs/intro', { title: 'Intro', category: 'Basics', order: 1 }, md('/docs/intro')),
        llmsPage('/blog', { title: 'Blog' }, md('/blog')),
        llmsPage('/app', { title: 'App' }), // tsx — no rendition
    ];

    it('emits title, blockquote, intro, and H2 sections per collection', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, { intro: 'Read this first.' });
        expect(out).toContain('# My Site');
        expect(out).toContain('> A test site');
        expect(out).toContain('Read this first.');
        // llmstxt.org convention: sections directly as H2, no TOC wrapper.
        expect(out).toContain('## Docs');
        expect(out).toContain('## Blog');
        expect(out).not.toContain('Table of Contents');
    });

    it('orders auto-section links by sidebar order and links the .md renditions', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, {});
        const intro = out.indexOf('- [Intro](/docs/intro.md)');
        const setup = out.indexOf('- [Setup](/docs/setup.md): Install it');
        expect(intro).toBeGreaterThan(-1);
        expect(setup).toBeGreaterThan(intro); // order: 1 before order: 2
    });

    it('puts collectionless pages under ## Other and omits tsx pages', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, {});
        expect(out).toContain('## Other');
        expect(out).toContain('- [Home](/index.md)');
        expect(out).not.toContain('[App]');
    });

    it('honors title/description overrides and base prefix', () => {
        const out = buildLlmsIndex(PAGES, { ...CONFIG, base: '/site/' }, { title: 'Custom', description: 'Desc' });
        expect(out).toContain('# Custom');
        expect(out).toContain('> Desc');
        expect(out).toContain('](/site/docs/intro.md)');
    });

    it('falls back to HTML routes when pageMd is off', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, { pageMd: false });
        expect(out).toContain('- [Intro](/docs/intro/)');
        expect(out).not.toContain('.md)');
    });

    it('expands curated sections: collections, pages, and links', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, {
            sections: [
                { title: 'Start Here', pages: ['/docs/intro'] },
                { title: 'Guides', collections: ['docs'] },
                {
                    title: 'More',
                    links: [
                        { title: 'The App', href: '/app', note: 'interactive' },
                        { title: 'Spec', href: 'https://llmstxt.org/' },
                    ],
                },
            ],
        });
        expect(out).toContain('## Start Here\n\n- [Intro](/docs/intro.md)');
        expect(out).toContain('## Guides');
        // tsx page via links → HTML route; external link passes through.
        expect(out).toContain('- [The App](/app/): interactive');
        expect(out).toContain('- [Spec](https://llmstxt.org/)');
    });

    it('appends a Docs sets block linking area files when areas are configured', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, {
            areas: { '/docs': { description: 'Just the docs' } },
        });
        expect(out).toContain('## Docs sets\n\n- [Docs](/docs/llms.txt): Just the docs');
    });

    it('omits index-disabled areas from the Docs sets block (no broken links)', () => {
        const out = buildLlmsIndex(PAGES, CONFIG, {
            areas: {
                '/docs': {},
                '/blog': { index: false }, // its /blog/llms.txt is never written
            },
        });
        expect(out).toContain('(/docs/llms.txt)');
        expect(out).not.toContain('/blog/llms.txt');
    });
});

describe('buildLlmsFullText (#176)', () => {
    const PAGES: LlmsPage[] = [
        llmsPage('/a', {}, md('/a')),
        llmsPage('/docs/b', {}, md('/docs/b')),
        llmsPage('/app', {}), // no rendition
    ];

    it('concatenates renditions, each with its url header', () => {
        const out = buildLlmsFullText(PAGES);
        expect(out).toContain('url: https://example.com/a/');
        expect(out).toContain('url: https://example.com/docs/b/');
        expect(out.indexOf('/a/')).toBeLessThan(out.indexOf('/docs/b/'));
    });

    it('applies include and exclude globs', () => {
        expect(buildLlmsFullText(PAGES, { exclude: ['/docs/**'] })).not.toContain('/docs/b');
        expect(buildLlmsFullText(PAGES, { include: ['/docs/*'] })).not.toContain('url: https://example.com/a/');
    });
});

describe('writeLlmsOutputs (#176)', () => {
    let outDir: string;

    beforeEach(() => {
        outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-test-'));
    });
    afterEach(() => {
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    const PAGES = [
        page('/', { title: 'Home' }),
        page('/docs/intro', { title: 'Intro', category: 'Basics', order: 1 }),
        page('/docs/setup', { title: 'Setup', category: 'Basics', order: 2 }),
    ];

    async function run(options = {}, pages = PAGES, publicDir?: string) {
        // page.source paths don't exist on disk — patch prepare via a real
        // source file per page instead: write them under outDir/src.
        const withSources = pages.map((p) => {
            const src = path.join(outDir, 'src', `${p.path === '/' ? 'index' : p.path.slice(1).replace(/\//g, '-')}.mdx`);
            fs.mkdirSync(path.dirname(src), { recursive: true });
            fs.writeFileSync(src, `---\ntitle: ${p.meta?.title}\n---\n\n# ${p.meta?.title}\n\nBody of ${p.path}\n`);
            return { ...p, source: src };
        });
        return writeLlmsOutputs(withSources, CONFIG, outDir, options, publicDir);
    }

    it('writes llms.txt, llms-full.txt, and nested .md renditions', async () => {
        const { files } = await run();
        expect(fs.existsSync(path.join(outDir, 'llms.txt'))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'llms-full.txt'))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'index.md'))).toBe(true);
        expect(fs.readFileSync(path.join(outDir, 'docs', 'intro.md'), 'utf-8')).toContain(
            'url: https://example.com/docs/intro/'
        );
        expect(files.length).toBe(5);
    });

    it('never overwrites an llms.txt shipped via public/', async () => {
        // Vite copies public/ into outDir before this stage runs.
        const publicDir = path.join(outDir, '.public');
        fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(path.join(publicDir, 'llms.txt'), 'user-authored\n');
        fs.writeFileSync(path.join(outDir, 'llms.txt'), 'user-authored\n');
        await run({}, PAGES, publicDir);
        expect(fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf-8')).toBe('user-authored\n');
        // ...while files with no public/ source are still written
        expect(fs.existsSync(path.join(outDir, 'llms-full.txt'))).toBe(true);
    });

    it("overwrites a previous build's llms.txt (outDir is not emptied between builds)", async () => {
        // A stale file in outDir alone is a derived artifact from the last
        // run, not a user file — guarding on its existence would make the
        // first build's output permanent.
        const publicDir = path.join(outDir, '.public');
        fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'llms.txt'), 'stale from a previous build\n');
        await run({}, PAGES, publicDir);
        expect(fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf-8')).toContain('# My Site');
    });

    it('honors index/full/pageMd toggles and a custom full output name', async () => {
        await run({ index: false, full: { output: 'everything.txt' }, pageMd: false });
        expect(fs.existsSync(path.join(outDir, 'llms.txt'))).toBe(false);
        expect(fs.existsSync(path.join(outDir, 'everything.txt'))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'index.md'))).toBe(false);
    });

    it('emits area files scoped on a segment boundary (#143)', async () => {
        const { warnings } = await run(
            { areas: { '/docs': {} } },
            [...PAGES, page('/docs-other/page', { title: 'Impostor' })]
        );
        const area = fs.readFileSync(path.join(outDir, 'docs', 'llms.txt'), 'utf-8');
        expect(area).toContain('# Docs');
        expect(area).toContain('- [Intro](/docs/intro.md)');
        expect(area).not.toContain('Impostor');
        expect(area).not.toContain('Home');
        // area llms-full.txt is opt-in
        expect(fs.existsSync(path.join(outDir, 'docs', 'llms-full.txt'))).toBe(false);
        expect(warnings).toEqual([]);
    });

    it('emits an area llms-full.txt when opted in', async () => {
        await run({ areas: { '/docs': { full: true } } });
        const full = fs.readFileSync(path.join(outDir, 'docs', 'llms-full.txt'), 'utf-8');
        expect(full).toContain('url: https://example.com/docs/intro/');
        expect(full).not.toContain('url: https://example.com/\n');
    });

    it('applies a per-area exclude to the area outputs', async () => {
        await run({ areas: { '/docs': { exclude: ['/docs/setup'], full: true } } });
        const area = fs.readFileSync(path.join(outDir, 'docs', 'llms.txt'), 'utf-8');
        expect(area).toContain('- [Intro](/docs/intro.md)');
        expect(area).not.toContain('Setup');
        const full = fs.readFileSync(path.join(outDir, 'docs', 'llms-full.txt'), 'utf-8');
        expect(full).not.toContain('/docs/setup');
        // ...without affecting the site-wide outputs
        expect(fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf-8')).toContain('Setup');
    });

    it('drops the colliding page from .md links, not just from emission', async () => {
        // '/about' and '/about.html' both map to about.md — the first wins;
        // the loser must fall back to its HTML route in llms.txt instead of
        // linking the winner's rendition.
        const { warnings } = await run({}, [
            page('/about', { title: 'About' }),
            page('/about.html', { title: 'About Html' }),
        ]);
        expect(warnings.some((w) => w.includes('collision'))).toBe(true);
        const index = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf-8');
        expect(index).toContain('- [About](/about.md)');
        expect(index).toContain('- [About Html](/about.html)');
    });

    it('warns and skips an area with no pages', async () => {
        const { warnings } = await run({ areas: { '/nowhere': {} } });
        expect(warnings.some((w) => w.includes("'/nowhere'"))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'nowhere'))).toBe(false);
    });
});
