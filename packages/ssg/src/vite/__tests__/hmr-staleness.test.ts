/**
 * Regression coverage for signalxjs/ssg#53:
 * 1. Editing a layout file invalidated the virtual layouts module but sent no
 *    HMR update or reload (`handleHotUpdate` returned [] without notifying),
 *    so the browser showed stale UI until a manual refresh.
 * 2. The frontmatter hash cache was never seeded, and the change handler only
 *    invalidated when an old hash existed — the FIRST frontmatter edit per
 *    file after server start was silently dropped.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ssgPlugin } from '../plugin';

let root: string;

function writePage(name: string, content: string): string {
    const file = path.join(root, 'src', 'pages', name);
    fs.writeFileSync(file, content);
    return file;
}

function mockServer() {
    return {
        watcher: {
            handlers: {} as Record<string, (file: string) => void | Promise<void>>,
            on(event: string, handler: (file: string) => void) {
                this.handlers[event] = handler;
            },
        },
        moduleGraph: {
            getModuleById: vi.fn(() => ({ id: 'fake' })),
            invalidateModule: vi.fn(),
        },
        ws: { send: vi.fn() },
        middlewares: { use: vi.fn() },
        transformIndexHtml: vi.fn(),
    };
}

async function createPlugin() {
    const [main] = ssgPlugin();
    await (main as any).configResolved({ command: 'serve', root, base: '/' });
    return main as any;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-hmr-'));
    fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'layouts'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('layout edits trigger a reload (#53)', () => {
    it('sends full-reload when a layout file changes', async () => {
        const plugin = await createPlugin();
        const server = mockServer();

        const layoutFile = path.join(root, 'src', 'layouts', 'default.tsx');
        fs.writeFileSync(layoutFile, 'export default {}');

        await plugin.handleHotUpdate({ file: layoutFile, server });

        expect(server.moduleGraph.invalidateModule).toHaveBeenCalled();
        expect(server.ws.send).toHaveBeenCalledWith({ type: 'full-reload' });
    });
});

describe('frontmatter change detection (#53)', () => {
    it('invalidates on the FIRST frontmatter edit after server start', async () => {
        const plugin = await createPlugin();
        const server = mockServer();
        plugin.configureServer(server);

        const file = writePage('doc.mdx', '---\ntitle: Edited\n---\n\n# Doc\n');
        await server.watcher.handlers['change'](file);

        expect(server.ws.send).toHaveBeenCalledWith({ type: 'full-reload' });
    });

    it('does not reload when a seeded file is re-saved with identical frontmatter', async () => {
        const file = writePage('doc.mdx', '---\ntitle: Same\n---\n\n# Doc\n');

        const plugin = await createPlugin();
        const server = mockServer();
        plugin.configureServer(server);

        // Loading the routes module seeds the frontmatter cache from the scan.
        await plugin.load('\0virtual:ssg-routes');

        await server.watcher.handlers['change'](file);
        expect(server.ws.send).not.toHaveBeenCalled();
    });

    it('reloads when a seeded file gets different frontmatter', async () => {
        const file = writePage('doc.mdx', '---\ntitle: Before\n---\n\n# Doc\n');

        const plugin = await createPlugin();
        const server = mockServer();
        plugin.configureServer(server);
        await plugin.load('\0virtual:ssg-routes');

        fs.writeFileSync(file, '---\ntitle: After\n---\n\n# Doc\n');
        await server.watcher.handlers['change'](file);

        expect(server.ws.send).toHaveBeenCalledWith({ type: 'full-reload' });
    });
});
