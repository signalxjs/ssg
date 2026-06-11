/**
 * @sigx/ssg CLI plugin
 *
 * Registers dev, build, and preview commands with the sigx CLI.
 * Auto-detected when a project has ssg.config.ts.
 */

import { definePlugin } from '@sigx/cli/plugin';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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
                config: { type: 'string', description: 'Path to ssg.config.ts' },
                port: { type: 'string', description: 'Port number' },
                host: { type: 'boolean', description: 'Expose to network' },
                open: { type: 'boolean', description: 'Open browser' },
                verbose: { type: 'boolean', description: 'Verbose logging' },
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
                config: { type: 'string', description: 'Path to ssg.config.ts' },
                verbose: { type: 'boolean', description: 'Verbose logging' },
                drafts: { type: 'boolean', description: 'Include draft: true pages in the build' },
            },
            async run(ctx) {
                const { build } = await import('./build.js');
                await build({
                    configPath: ctx.args.config as string | undefined,
                    verbose: ctx.args.verbose as boolean | undefined,
                    drafts: ctx.args.drafts as boolean | undefined,
                });
            },
        },
        preview: {
            description: 'Preview production build locally',
            args: {
                config: { type: 'string', description: 'Path to ssg.config.ts' },
                port: { type: 'string', description: 'Port number' },
                host: { type: 'boolean', description: 'Expose to network' },
                open: { type: 'boolean', description: 'Open browser' },
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
