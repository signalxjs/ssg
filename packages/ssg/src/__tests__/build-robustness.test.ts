/**
 * Regression coverage for signalxjs/ssg#52 — build robustness:
 *
 * 1. Rendered HTML was spliced with string-pattern String.replace, so page
 *    content containing `$&`, "$`" or "$'" was corrupted.
 * 2. A syntax/runtime error in ssg.config.ts was logged and silently replaced
 *    with the default config — the build "succeeded" with wrong settings.
 * 3. A configured theme that fails to load was downgraded to a console.warn.
 * 4. Cleanup (restoring the user's index.html, removing temp entries) did not
 *    run on SIGINT/SIGTERM.
 * 5. Zero-config builds had no way to assemble the plugin set the dev server
 *    injects (helpers extracted and shared).
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('injectIntoTemplate — $-pattern safety (#52)', () => {
    it('preserves replacement patterns in page HTML verbatim', async () => {
        const { injectIntoTemplate } = await import('../template');
        const template = '<head><!--head-tags--></head><body><div id="app"><!--app-html--></div></body>';
        const appHtml = "<pre>regex: $& and $` and $' and $1</pre>";
        const headTags = '<title>$&</title>';

        const html = injectIntoTemplate(template, appHtml, headTags);
        expect(html).toContain("regex: $& and $` and $' and $1");
        expect(html).toContain('<title>$&</title>');
        expect(html).not.toContain('<!--app-html-->');
        expect(html).not.toContain('<!--head-tags-->');
    });
});

describe('loadConfig — config errors are loud (#52)', () => {
    it('rejects when ssg.config.ts has a syntax error', async () => {
        const { loadConfig } = await import('../config');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-cfg-'));
        const file = path.join(dir, 'ssg.config.ts');
        fs.writeFileSync(file, 'export default { site: { title: "x" '); // unterminated

        try {
            await expect(loadConfig(file)).rejects.toThrow(/config/i);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('rejects when ssg.config.ts throws at import time', async () => {
        const { loadConfig } = await import('../config');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-cfg-'));
        const file = path.join(dir, 'ssg.config.ts');
        fs.writeFileSync(file, 'throw new Error("boom in config");\nexport default {};');

        try {
            await expect(loadConfig(file)).rejects.toThrow(/config/i);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('discoverLayouts — missing theme is loud (#52)', () => {
    it('rejects when the configured theme package cannot be loaded', async () => {
        const { discoverLayouts } = await import('../layouts/resolver');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-theme-'));
        fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"t","type":"module"}');

        try {
            await expect(
                discoverLayouts({ theme: '@nonexistent/ssg-theme' }, dir)
            ).rejects.toThrow(/@nonexistent\/ssg-theme/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('registerProcessCleanup (#52)', () => {
    it('runs cleanup and exits on SIGINT', async () => {
        const { registerProcessCleanup } = await import('../cleanup');
        const cleanup = vi.fn();
        const exit = vi.fn();

        const unregister = registerProcessCleanup(cleanup, exit as any);
        process.emit('SIGINT');

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(exit).toHaveBeenCalledWith(130);
        unregister();
    });

    it('unregister removes the handlers', async () => {
        const { registerProcessCleanup } = await import('../cleanup');
        const cleanup = vi.fn();
        const exit = vi.fn();

        const unregister = registerProcessCleanup(cleanup, exit as any);
        unregister();
        process.emit('SIGTERM');

        expect(cleanup).not.toHaveBeenCalled();
        expect(exit).not.toHaveBeenCalled();
    });
});

describe('zero-config vite helpers (#52)', () => {
    it('hasViteConfigFile detects all vite config flavors', async () => {
        const { hasViteConfigFile } = await import('../vite/zero-config');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-zc-'));
        try {
            expect(hasViteConfigFile(dir)).toBe(false);
            fs.writeFileSync(path.join(dir, 'vite.config.mts'), 'export default {}');
            expect(hasViteConfigFile(dir)).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('assembleZeroConfigPlugins includes the SSG plugin', async () => {
        const { assembleZeroConfigPlugins } = await import('../vite/zero-config');
        const plugins = (await assembleZeroConfigPlugins()).flat();
        expect(plugins.some((p: any) => p?.name === 'sigx-ssg')).toBe(true);
    });
});

describe('loadConfig — relative .ts imports are bundled (#96)', () => {
    it('loads a config importing a relative .ts helper regardless of Node type-stripping', async () => {
        const { loadConfig } = await import('../config');
        // Inside the workspace: vitest's Vite server can't import temp .mjs
        // files from outside its root (/tmp), unlike real Node usage.
        const base = path.join(process.cwd(), 'node_modules', '.cache');
        fs.mkdirSync(base, { recursive: true });
        const dir = fs.mkdtempSync(path.join(base, 'ssg-cfg-rel-'));
        fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
        // An enum is NOT erasable syntax — Node's native type-stripping
        // rejects it, so this only works when the loader actually compiles.
        fs.writeFileSync(path.join(dir, 'lib', 'registry.ts'),
            "export enum Kind { Docs = 'docs' }\nexport const TITLE: string = 'From Helper';\n");
        fs.writeFileSync(path.join(dir, 'ssg.config.ts'),
            "import { TITLE, Kind } from './lib/registry.ts';\nexport default { site: { title: TITLE + ':' + Kind.Docs } };\n");

        try {
            const config = await loadConfig(path.join(dir, 'ssg.config.ts'));
            expect(config.site?.title).toBe('From Helper:docs');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
