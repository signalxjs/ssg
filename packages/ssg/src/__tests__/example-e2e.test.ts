/**
 * End-to-end build test (signalxjs/ssg#72): builds examples/basic through the
 * real production pipeline (vite client + SSR bundles, render, sitemap) and
 * asserts on the emitted files. This is the regression gate for the class of
 * bugs unit tests can't see — dynamic routes silently skipped (#46), drafts
 * published (#48), canonical/sitemap URL drift (#41).
 *
 * Requires packages/ssg/dist (the example resolves `@sigx/ssg` through the
 * workspace link's exports map). CI's test job runs `pnpm build` first; the
 * suite skips with a notice when dist is missing (e.g. the coverage job).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const PKG_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');
const EXAMPLE_DIR = path.join(REPO_ROOT, 'examples', 'basic');
const DIST = path.join(EXAMPLE_DIR, 'dist');

const ssgDistBuilt = fs.existsSync(path.join(PKG_ROOT, 'dist', 'build.js'));
if (!ssgDistBuilt) {
    console.warn('[example-e2e] packages/ssg/dist not built — skipping e2e build test (run `pnpm build` first)');
}

function read(...segments: string[]): string {
    const raw = fs.readFileSync(path.join(DIST, ...segments), 'utf-8');
    // For HTML only: strip the renderer's <!--t--> hydration text-boundary
    // markers (signalxjs/core#97 — works as designed) so substring
    // assertions can't silently depend on where a boundary falls (the
    // misdiagnosis behind signalxjs/ssg#133). Non-HTML artifacts (JSON,
    // CSS, _redirects) are returned byte-exact.
    return segments[segments.length - 1].endsWith('.html') ? raw.replace(/<!--t-->/g, '') : raw;
}

describe.skipIf(!ssgDistBuilt)('examples/basic — end-to-end production build', () => {
    beforeAll(async () => {
        fs.rmSync(DIST, { recursive: true, force: true });
        await execFileAsync(process.execPath, ['build.mjs'], {
            cwd: EXAMPLE_DIR,
            timeout: 180_000,
        });
    }, 200_000);

    it('renders static pages with content and head tags', () => {
        const home = read('index.html');
        expect(home).toContain('basic example');
        expect(home).toContain('<title>Home</title>');
        expect(home).not.toContain('<!--app-html-->');
        expect(home).not.toContain('<!--head-tags-->');
    });

    it('emits og:site_name and auto JSON-LD breadcrumbs/article (#206)', () => {
        const guide = read('docs', 'getting-started', 'index.html');
        expect(guide).toContain('<meta property="og:site_name" content="SSG Basic Example">');

        const blocks = [...guide.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) =>
            JSON.parse(m[1].replace(/\\u003c/g, '<'))
        );
        const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList');
        expect(crumbs).toBeDefined();
        expect(crumbs.itemListElement[0]).toMatchObject({ position: 1, item: 'https://basic.example/' });
        expect(crumbs.itemListElement.at(-1).item).toBe('https://basic.example/docs/getting-started/');
        const article = blocks.find((b) => b['@type'] === 'TechArticle');
        expect(article).toMatchObject({ url: 'https://basic.example/docs/getting-started/' });
    });

    it("emits head tags from a TSX page's export const meta (#205)", () => {
        const about = read('about', 'index.html');
        expect(about).toContain('<title>About - Basic Example</title>');
        expect(about).toContain(
            '<meta name="description" content="A TSX page whose export const meta drives the build-time head tags (#205).">'
        );

        // The dynamic TSX route's meta reaches head tags too.
        const first = read('blog', 'first-post', 'index.html');
        expect(first).toContain('<title>Blog post</title>');
        expect(first).toContain('<meta name="description" content="A statically generated blog post">');
    });

    it('builds dynamic routes from getStaticPaths (#46)', () => {
        // The SSR renderer may emit text-marker comments between text parts.
        const first = read('blog', 'first-post', 'index.html');
        expect(first).toMatch(/Post: (<!--[^>]*-->)?first-post/);
        expect(first).toContain('Rendered at build time from getStaticPaths.');

        const second = read('blog', 'second-post', 'index.html');
        expect(second).toMatch(/Post: (<!--[^>]*-->)?second-post/);
    });

    it('passes getStaticPaths props to page components and embeds them for hydration (#73)', () => {
        const first = read('blog', 'first-post', 'index.html');
        expect(first).toContain('This post is featured.');
        expect(first).toContain('window.__SSG_PROPS__');
        expect(first).toContain('"featured":true');

        const second = read('blog', 'second-post', 'index.html');
        expect(second).not.toContain('This post is featured.');
        expect(second).not.toContain('window.__SSG_PROPS__');
    });

    it('emits <lastmod> derived from source files and honors the transform (#38)', () => {
        const sitemap = read('sitemap.xml');
        expect(sitemap).toContain('<lastmod>');
        // transform bumped /guide's priority
        const guideBlock = sitemap.split('<url>').find((b) => b.includes('/guide/</loc>'));
        expect(guideBlock).toContain('<priority>0.9</priority>');
    });

    it('emits a default 404.html when the site has none (#65)', () => {
        const html = read('404.html');
        expect(html).toContain('404');
        expect(html).toContain('href="/"');
    });

    it('passes link validation in error mode (#99)', () => {
        // linkCheck: 'error' in the example config — the build succeeding at
        // all proves every internal href/anchor resolves.
        expect(fs.existsSync(path.join(DIST, 'index.html'))).toBe(true);
    });

    it('emits a search index over the rendered pages (#62)', () => {
        const index = JSON.parse(read('search-index.json'));
        expect(index.version).toBe(1);

        const guide = index.entries.find((e: { path: string }) => e.path === '/guide');
        expect(guide).toBeDefined();
        expect(guide.title.length).toBeGreaterThan(0);
        expect(guide.headings.length).toBeGreaterThan(0);
        expect(guide.text.length).toBeGreaterThan(0);

        // Visibility convention matches the sitemap: no drafts, no 404.
        const paths = index.entries.map((e: { path: string }) => e.path);
        expect(paths).not.toContain('/drafts-demo');
        expect(paths.some((p: string) => p.startsWith('/404'))).toBe(false);
    });

    it('builds programmatic routes with data-loader values baked in (#59)', () => {
        const generated = read('generated', 'index.html');
        expect(generated).toContain('This page was added by config.routes');
        // virtual:ssg-data value rendered into the page.
        expect(generated).toContain('data-loaders');
        expect(generated).toContain('<title>Generated route');
    });

    it('excludes draft pages from the output and the sitemap (#48)', () => {
        expect(fs.existsSync(path.join(DIST, 'drafts-demo'))).toBe(false);
        expect(read('sitemap.xml')).not.toContain('drafts-demo');
    });

    it('emits trailing-slash canonical and sitemap URLs that match (#41)', () => {
        const guide = read('guide', 'index.html');
        expect(guide).toContain('<link rel="canonical" href="https://basic.example/guide/">');
        expect(guide).toContain('<meta property="og:url" content="https://basic.example/guide/">');

        const sitemap = read('sitemap.xml');
        expect(sitemap).toContain('<loc>https://basic.example/guide/</loc>');
        expect(sitemap).toContain('<loc>https://basic.example/blog/first-post/</loc>');
        expect(sitemap).toContain('<loc>https://basic.example/</loc>');
    });

    it('renders the package-manager switcher on install fences', () => {
        // The command text is shiki-tokenized into spans, so assert on the
        // structural markup: the tab strip and all four pre-rendered variants.
        const guide = read('guide', 'index.html');
        expect(guide).toContain('code-window-pm-tab');
        for (const pm of ['npm', 'pnpm', 'yarn', 'bun']) {
            expect(guide).toContain(`data-pm-variant="${pm}"`);
        }
    });

    it('writes robots.txt pointing at the sitemap', () => {
        expect(read('robots.txt')).toContain('Sitemap: https://basic.example/sitemap.xml');
    });

    it('applies the custom layout', () => {
        expect(read('index.html')).toContain('Built with @sigx/ssg');
    });


    it('ships the base stylesheet for ssg-emitted markup (#64)', () => {
        const assets = path.join(DIST, 'assets');
        const cssFiles = fs.readdirSync(assets).filter((f) => f.endsWith('.css'));
        expect(cssFiles.length).toBeGreaterThan(0);
        const css = cssFiles.map((f) => fs.readFileSync(path.join(assets, f), 'utf-8')).join('\n');
        expect(css).toContain('.code-window');
        expect(css).toContain('.heading-anchor');
        // The example's own typography (zero-config global.css auto-import)
        expect(css).toContain('.site');

        const guide = read('guide', 'index.html');
        expect(guide).toMatch(/<link rel="stylesheet"[^>]*\.css/);
    });

    it('renders site navigation and the auto-generated docs sidebar (#87)', () => {
        // Header nav on every page
        const home = read('index.html');
        expect(home).toContain('class="site-header"');
        expect(home).toContain('href="/guide"');

        // Docs pages get the docs layout from collections.docs.layout (#85)
        // and a sidebar generated from frontmatter category/order — the pages
        // themselves declare no layout.
        const docs = read('docs', 'getting-started', 'index.html');
        expect(docs).toContain('docs-sidebar');
        expect(docs).toContain('Going further');
        expect(docs).toContain('href="/docs/configuration"');

        // Active item is marked
        const config = read('docs', 'configuration', 'index.html');
        expect(config).toMatch(/aria-current="page"[^>]*>|href="\/docs\/configuration"[^>]*aria-current="page"/);

        // Non-docs pages keep the default layout (no sidebar)
        expect(read('guide', 'index.html')).not.toContain('docs-sidebar');
    });

    it('runs build pipeline hooks (#58)', () => {
        // transformHtml ran on every page
        expect(read('index.html')).toContain('<meta name="generator" content="@sigx/ssg">');
        expect(read('blog', 'first-post', 'index.html')).toContain('<meta name="generator" content="@sigx/ssg">');

        // postBuild ran once with the build result
        const manifest = JSON.parse(read('build-manifest.json'));
        expect(manifest.pages.length).toBeGreaterThanOrEqual(8);
        expect(manifest.pages.map((p: { path: string }) => p.path)).toContain('/guide');

        // onPageRendered ran for every page (collected into the manifest)
        expect(manifest.rendered).toContain('/guide');
        expect(manifest.rendered.length).toBe(manifest.pages.length);
    });

    it('emits configured redirects (#61)', () => {
        const redirect = read('old-guide', 'index.html');
        expect(redirect).toContain('http-equiv="refresh"');
        expect(redirect).toContain('url=/guide/');
        expect(redirect).toContain('<meta name="robots" content="noindex">');
        expect(read('_redirects')).toContain('/old-guide /guide/ 301');
        // redirects are not crawlable content
        expect(read('sitemap.xml')).not.toContain('old-guide');
    });

    it('emits an llms.txt index over the markdown pages (#176)', () => {
        const index = read('llms.txt');
        expect(index).toContain('# SSG Basic Example');
        expect(index).toContain('> A minimal site built with @sigx/ssg');

        // Sections are H2s (llmstxt.org convention), one per collection,
        // links in sidebar (category/order) order pointing at .md renditions.
        const docs = index.indexOf('## Docs');
        const start = index.indexOf('- [Getting Started](/docs/getting-started.md)');
        const config = index.indexOf('- [Configuration](/docs/configuration.md)');
        expect(docs).toBeGreaterThan(-1);
        expect(start).toBeGreaterThan(docs);
        expect(config).toBeGreaterThan(start); // order: 1 before order: 2

        // Area hub block
        expect(index).toContain('## Docs sets');
        expect(index).toContain('- [Docs](/docs/llms.txt): The docs collection as its own set');

        // No drafts, no tsx-backed dynamic pages, no redirects
        expect(index).not.toContain('drafts-demo');
        expect(index).not.toContain('first-post');
        expect(index).not.toContain('old-guide');
    });

    it('emits per-page .md renditions next to the HTML (#176)', () => {
        const md = read('docs', 'getting-started.md');
        expect(md.startsWith('---\nurl: https://basic.example/docs/getting-started/\n')).toBe(true);
        expect(md).toContain('title: Getting Started');
        // Original frontmatter is replaced by the header block
        expect(md).not.toContain('category:');
        // Fence body survives verbatim
        expect(md).toContain('npm install @sigx/ssg sigx');

        // MDX syntax is stripped, fence contents are not (guide.mdx carries
        // an import inside a ```ts fence)
        const guide = read('guide.md');
        expect(guide).toContain("import { defineSSGConfig } from '@sigx/ssg';");

        const features = read('docs', 'mdx-features.md');
        expect(features).not.toContain('<Callout');
        expect(features).not.toContain('never renders');
        expect(features).toContain('version 1.2.3');
        // The top-level import is stripped; the identical line inside the
        // fence is untouched — so exactly one copy survives, fenced.
        const importLine = "import Callout from '../../components/Callout';";
        expect(features.split(importLine).length - 1).toBe(1);
        expect(features).toContain(`\`\`\`ts\n${importLine}\n\`\`\``);

        // No renditions for drafts or tsx-backed pages
        expect(fs.existsSync(path.join(DIST, 'drafts-demo.md'))).toBe(false);
        expect(fs.existsSync(path.join(DIST, 'blog', 'first-post.md'))).toBe(false);
    });

    it('emits llms-full.txt and the /docs area index (#176)', () => {
        const full = read('llms-full.txt');
        expect(full).toContain('url: https://basic.example/guide/');
        expect(full).toContain('url: https://basic.example/docs/getting-started/');
        expect(full).not.toContain('drafts-demo');

        const area = read('docs', 'llms.txt');
        expect(area).toContain('- [Getting Started](/docs/getting-started.md)');
        // Scoped to the /docs prefix only
        expect(area).not.toContain('(/guide.md)');
        expect(area).not.toContain('(/index.md)');
    });
});
