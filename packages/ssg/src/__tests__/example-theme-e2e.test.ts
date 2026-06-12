/**
 * Theme end-to-end build test (signalxjs/ssg#116): builds examples/theme —
 * a site running entirely on @sigx/ssg-theme-daisyui — and asserts the
 * theme-rendered markup. The theme previously had NO demo surface or e2e
 * (examples/basic uses its own layouts); that's how the broken light/dark
 * toggle originally shipped unnoticed.
 *
 * Requires packages/ssg/dist + packages/ssg-theme-daisyui/dist; skips with
 * a notice otherwise (CI's test job runs `pnpm build` first).
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
const EXAMPLE_DIR = path.join(REPO_ROOT, 'examples', 'theme');
const DIST = path.join(EXAMPLE_DIR, 'dist');

const distBuilt =
    fs.existsSync(path.join(PKG_ROOT, 'dist', 'build.js')) &&
    fs.existsSync(path.join(REPO_ROOT, 'packages', 'ssg-theme-daisyui', 'dist', 'index.js'));
if (!distBuilt) {
    console.warn('[example-theme-e2e] package dist not built — skipping (run `pnpm build` first)');
}

function read(...segments: string[]): string {
    return fs.readFileSync(path.join(DIST, ...segments), 'utf-8');
}

describe.skipIf(!distBuilt)('examples/theme — end-to-end production build on the daisyui theme', () => {
    beforeAll(async () => {
        fs.rmSync(DIST, { recursive: true, force: true });
        await execFileAsync(process.execPath, ['build.mjs'], {
            cwd: EXAMPLE_DIR,
            timeout: 180_000,
        });
    }, 200_000);

    it('renders pages through the theme layouts (header chrome + branding)', () => {
        const home = read('index.html');
        expect(home).toContain('navbar'); // theme Header
        expect(home).toContain('Theme Example'); // site.title branding (#60)
        expect(home).toContain('https://github.com/signalxjs/ssg'); // site.repo link
    });

    it('shows the ⌘K palette button via the site.search pass-through (#116)', () => {
        const home = read('index.html');
        expect(home).toContain('command-palette');
        expect(home).toContain('⌘K');
    });

    it('injects the no-FOUC theme-init script into <head> (#65)', () => {
        const home = read('index.html');
        expect(home).toContain('sigx-theme');
        expect(home).toContain('prefers-color-scheme');
        // Before the stylesheet/body — it must run pre-paint.
        expect(home.indexOf('sigx-theme')).toBeLessThan(home.indexOf('<body'));
    });

    it('renders the docs shell: collapsible sidebar, TOC slot, prev/next (#65)', () => {
        const middle = read('docs', 'configuration', 'index.html');
        expect(middle).toContain('<details open'); // collapsible sidebar group
        expect(middle).toContain('class="prev-next'); // PrevNext component
        expect(middle).toContain('Getting started'); // prev link target
        expect(middle).toContain('Components'); // next link target
    });

    it('renders code windows with copy buttons and the pm switcher', () => {
        const components = read('docs', 'components', 'index.html');
        expect(components).toContain('code-window-copy');
        expect(components).toContain('code-window-pm');
        expect(components).toContain('data-pm-variant="yarn"');
    });

    it('emits the search index the palette queries', () => {
        const index = JSON.parse(read('search-index.json'));
        const paths = index.entries.map((e: { path: string }) => e.path);
        expect(paths).toContain('/docs/getting-started');
    });

    it('generates the daisyui CSS (theme classes survive the Tailwind scan)', () => {
        const assets = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.css'));
        expect(assets.length).toBeGreaterThan(0);
        const css = assets.map((f) => read('assets', f)).join('\n');
        expect(css).toContain('.navbar'); // daisyui component class used by Header
        expect(css).toContain('.menu'); // sidebar/palette lists
    });
});

describe('per-page chrome (#65) and showcase pages', () => {
    it('renders the announcement bar markup in every layout', () => {
        for (const file of [['index.html'], ['docs', 'configuration', 'index.html'], ['blog', 'hello-theme', 'index.html']]) {
            expect(read(...file)).toContain('announcement-bar');
        }
        expect(read('index.html')).toContain('zero layout code');
    });

    it('renders breadcrumbs from the collection sidebar', () => {
        const html = read('docs', 'configuration', 'index.html');
        expect(html).toContain('breadcrumbs');
        expect(html).toContain('Guide'); // section crumb
    });

    it('renders the edit-this-page link from editBase + sourceFile', () => {
        const html = read('docs', 'configuration', 'index.html');
        expect(html).toContain(
            'https://github.com/signalxjs/ssg/edit/main/examples/theme/src/pages/docs/configuration.mdx'
        );
        expect(html).toContain('Edit this page');
    });

    it('renders last-updated from frontmatter', () => {
        const html = read('docs', 'configuration', 'index.html');
        expect(html).toContain('Last updated');
        expect(html).toContain('2026-06-11');
    });

    it('renders the blog layout hero for posts', () => {
        const html = read('blog', 'hello-theme', 'index.html');
        expect(html).toContain('Hello from the blog layout');
        expect(html).toContain('By SignalX');
    });

    it('honors per-collection sectionOrder (Guide before Reference)', () => {
        const html = read('docs', 'getting-started', 'index.html');
        const guidePos = html.indexOf('>Guide<');
        const refPos = html.indexOf('>Reference<');
        expect(guidePos).toBeGreaterThan(-1);
        expect(refPos).toBeGreaterThan(guidePos);
    });
});
