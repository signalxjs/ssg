/**
 * @sigx/ssg CLI plugin
 *
 * Registers dev, build, and preview commands with the sigx CLI.
 * Auto-detected when a project has ssg.config.ts.
 */

import { a, definePlugin } from '@sigx/cli/plugin';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Parse and validate the --concurrency flag: a positive integer, or
 * undefined when not given. NaN/0/negative values would silently render
 * nothing or hang the batch loop.
 */
function parseConcurrency(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
        throw new Error(`--concurrency must be a positive integer, got "${value}"`);
    }
    return n;
}

export default definePlugin({
    name: 'ssg',
    detect: (cwd) =>
        existsSync(join(cwd, 'ssg.config.ts')) ||
        existsSync(join(cwd, 'ssg.config.js')) ||
        existsSync(join(cwd, 'ssg.config.mjs')),
    commands: {
        dev: {
            description: 'Start SSG development server',
            args: {
                config: a.string().describe('Path to ssg.config.ts'),
                port: a.string().describe('Port number'),
                host: a.boolean().describe('Expose to network'),
                open: a.boolean().describe('Open browser'),
                verbose: a.boolean().describe('Verbose logging'),
            },
            async run(ctx) {
                const { dev } = await import('./dev.js');
                await dev({
                    configPath: ctx.args.config as string | undefined,
                    port: ctx.args.port ? Number(ctx.args.port) : undefined,
                    host: ctx.args.host as boolean | undefined,
                    open: ctx.args.open as boolean | undefined,
                    verbose: ctx.args.verbose as boolean | undefined,
                });
            },
        },
        build: {
            description: 'Build static site for production',
            args: {
                config: a.string().describe('Path to ssg.config.ts'),
                verbose: a.boolean().describe('Verbose logging'),
                drafts: a.boolean().describe('Include draft: true pages in the build'),
                concurrency: a.string().describe('Pages to render in parallel (default 20)'),
            },
            async run(ctx) {
                const { build } = await import('./build.js');
                await build({
                    configPath: ctx.args.config as string | undefined,
                    verbose: ctx.args.verbose as boolean | undefined,
                    drafts: ctx.args.drafts as boolean | undefined,
                    concurrency: parseConcurrency(ctx.args.concurrency as string | undefined),
                });
            },
        },
        preview: {
            description: 'Preview production build locally',
            args: {
                config: a.string().describe('Path to ssg.config.ts'),
                port: a.string().describe('Port number'),
                host: a.boolean().describe('Expose to network'),
                open: a.boolean().describe('Open browser'),
            },
            async run(ctx) {
                const { preview } = await import('./dev.js');
                await preview({
                    configPath: ctx.args.config as string | undefined,
                    port: ctx.args.port ? Number(ctx.args.port) : undefined,
                    host: ctx.args.host as boolean | undefined,
                    open: ctx.args.open as boolean | undefined,
                });
            },
        },
    },
});
