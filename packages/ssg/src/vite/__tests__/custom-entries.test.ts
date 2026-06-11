/**
 * Regression coverage for signalxjs/ssg#51 — documented config options that
 * were silent no-ops:
 *
 * - `clientEntry` / `serverEntry` / `htmlTemplate` were never read:
 *   `detectCustomEntries(root, config)` ignored its `config` parameter and
 *   only honored the convention paths.
 * - `CollectionConfig.layout` never influenced layout resolution despite the
 *   docs listing it as precedence step 3.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectCustomEntries } from '../virtual-entries';
import { generateRoutesModule } from '../../routing/virtual';
import type { SSGRoute } from '../../types';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-entries-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('detectCustomEntries — explicit config entries (#51)', () => {
    it('honors config.clientEntry over convention detection', () => {
        fs.writeFileSync(path.join(root, 'src', 'boot.tsx'), 'export {}');
        const detection = detectCustomEntries(root, { clientEntry: 'src/boot.tsx' });
        expect(detection.useVirtualClient).toBe(false);
        expect(detection.customClientPath).toBe(path.join(root, 'src', 'boot.tsx'));
    });

    it('honors config.serverEntry', () => {
        fs.writeFileSync(path.join(root, 'src', 'ssr.tsx'), 'export {}');
        const detection = detectCustomEntries(root, { serverEntry: 'src/ssr.tsx' });
        expect(detection.useVirtualServer).toBe(false);
        expect(detection.customServerPath).toBe(path.join(root, 'src', 'ssr.tsx'));
    });

    it('honors config.htmlTemplate (string path)', () => {
        fs.writeFileSync(path.join(root, 'shell.html'), '<html></html>');
        const detection = detectCustomEntries(root, { htmlTemplate: 'shell.html' });
        expect(detection.useVirtualHtml).toBe(false);
        expect(detection.customHtmlPath).toBe(path.join(root, 'shell.html'));
    });

    it('htmlTemplate: false forces the virtual template even when index.html exists', () => {
        fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
        const detection = detectCustomEntries(root, { htmlTemplate: false });
        expect(detection.useVirtualHtml).toBe(true);
        expect(detection.customHtmlPath).toBeUndefined();
    });

    it('throws when an explicit entry does not exist (no silent fallback)', () => {
        expect(() => detectCustomEntries(root, { clientEntry: 'src/missing.tsx' })).toThrow(/clientEntry/);
    });

    it('still detects convention paths without config', () => {
        fs.writeFileSync(path.join(root, 'src', 'main.tsx'), 'export {}');
        const detection = detectCustomEntries(root, {});
        expect(detection.useVirtualClient).toBe(false);
    });
});

describe('CollectionConfig.layout — route layout resolution (#51)', () => {
    const routes: SSGRoute[] = [
        { path: '/docs/intro', file: '/site/src/pages/docs/intro.mdx', name: 'docs-intro', meta: {} },
        { path: '/blog/post', file: '/site/src/pages/blog/post.mdx', name: 'blog-post', meta: {} },
        { path: '/docs/styled', file: '/site/src/pages/docs/styled.mdx', name: 'docs-styled', meta: { layout: 'special' } },
    ];

    const config = {
        defaultLayout: 'default',
        collections: { docs: { path: '/docs', layout: 'docs' } },
    };

    it('pages in a collection default to the collection layout', () => {
        const code = generateRoutesModule(routes, config);
        expect(code).toContain("meta0.layout || 'docs'");
    });

    it('pages outside any collection keep the config default', () => {
        const code = generateRoutesModule(routes, config);
        expect(code).toContain("meta1.layout || 'default'");
    });

    it('frontmatter layout still wins (collection only fills the fallback)', () => {
        const code = generateRoutesModule(routes, config);
        expect(code).toContain("meta2.layout || 'docs'");
    });
});

describe('fallbackLayout — longest prefix wins (#51 review)', () => {
    it('nested collections pick the most specific layout', () => {
        const routes: SSGRoute[] = [
            { path: '/docs/api/ref', file: '/s/p/docs/api/ref.mdx', name: 'a', meta: {} },
            { path: '/docs/guide', file: '/s/p/docs/guide.mdx', name: 'b', meta: {} },
        ];
        const code = generateRoutesModule(routes, {
            defaultLayout: 'default',
            collections: {
                docs: { path: '/docs', layout: 'docs' },
                api: { path: '/docs/api', layout: 'api' },
            },
        });
        expect(code).toContain("meta0.layout || 'api'");
        expect(code).toContain("meta1.layout || 'docs'");
    });
});
