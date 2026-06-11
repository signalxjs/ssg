/**
 * Regression coverage for signalxjs/ssg#47: `markdown` and `toc` options from
 * the resolved SSG config (ssg.config.ts or ssgPlugin() args) never reached
 * the MDX pipeline — `ssgConfig` was "set by configResolved" according to a
 * comment, but never actually set, and `markdown` was destructured once at
 * plugin construction.
 */

import { describe, it, expect } from 'vitest';
import { mdxPlugin, type MDXPluginOptions } from '../plugin';
import { ssgPlugin } from '../../vite/plugin';

const MDX_FIXTURE = `# Title

## Section

### Subsection

\`\`\`js
const x = 1;
\`\`\`
`;

/** Run a plugin's configResolved + transform hooks like Vite would. */
async function runTransform(plugin: any, code: string, viteConfig: any = { command: 'build' }) {
    await plugin.configResolved?.(viteConfig);
    return plugin.transform?.(code, '/site/src/pages/test.mdx');
}

function exportedHeadings(code: string): Array<{ level: number }> {
    const match = code.match(/export const headings = (\[.*?\]);/s);
    expect(match).not.toBeNull();
    return JSON.parse(match![1]);
}

describe('mdxPlugin — options are read lazily (#47)', () => {
    it('honors ssgConfig.toc set after plugin construction', async () => {
        const options: MDXPluginOptions = {};
        const plugin = mdxPlugin(options);

        // Simulates ssgPlugin's configResolved filling in the loaded config
        // before the first transform runs.
        options.ssgConfig = { toc: { minLevel: 2, maxLevel: 2 } };

        const result = await runTransform(plugin, MDX_FIXTURE);
        const headings = exportedHeadings(result.code);
        expect(headings.length).toBeGreaterThan(0);
        expect(headings.every((h) => h.level === 2)).toBe(true);
    });

    it('honors markdown config set after plugin construction', async () => {
        const options: MDXPluginOptions = {};
        const plugin = mdxPlugin(options);

        options.markdown = { shiki: false };

        const result = await runTransform(plugin, MDX_FIXTURE);
        expect(result.code).not.toContain('code-window');
    });
});

describe('ssgPlugin — config reaches the MDX pipeline (#47)', () => {
    it('toc passed to ssgPlugin() controls extracted headings', async () => {
        const [main, mdx] = ssgPlugin({ toc: { minLevel: 2, maxLevel: 2 } });

        const viteConfig = { command: 'build', root: '/nonexistent-ssg-test', base: '/' };
        await (main as any).configResolved(viteConfig);
        const result = await runTransform(mdx, MDX_FIXTURE, viteConfig);

        const headings = exportedHeadings(result.code);
        expect(headings.length).toBeGreaterThan(0);
        expect(headings.every((h) => h.level === 2)).toBe(true);
    });

    it('markdown.shiki: false passed to ssgPlugin() disables highlighting', async () => {
        const [main, mdx] = ssgPlugin({ markdown: { shiki: false } });

        const viteConfig = { command: 'build', root: '/nonexistent-ssg-test', base: '/' };
        await (main as any).configResolved(viteConfig);
        const result = await runTransform(mdx, MDX_FIXTURE, viteConfig);

        expect(result.code).not.toContain('code-window');
    });
});
