/**
 * SSG Dev Server
 *
 * Starts a Vite development server with SSG plugins pre-configured.
 * Provides a unified `ssg dev` command for zero-config development.
 */

import path from 'node:path';
import fs from 'node:fs';
import type { SSGConfig } from './types';
import { loadConfig } from './config';
import { ssgPlugin } from './vite/plugin';

/**
 * Dev server options
 */
export interface DevOptions {
    /**
     * Path to ssg.config.ts
     */
    configPath?: string;

    /**
     * Port to run dev server on
     * @default 5173
     */
    port?: number;

    /**
     * Host to bind to
     * @default 'localhost'
     */
    host?: string | boolean;

    /**
     * Open browser automatically
     * @default false
     */
    open?: boolean;

    /**
     * Enable verbose logging
     */
    verbose?: boolean;
}

/**
 * Start the SSG development server
 */
export async function dev(options: DevOptions = {}): Promise<void> {
    const root = process.cwd();

    console.log('\n🚀 @sigx/ssg - Starting development server...\n');

    // Load SSG config
    const ssgConfig = await loadConfig(options.configPath);

    // Check if user has a vite.config.ts
    const hasViteConfig = fs.existsSync(path.join(root, 'vite.config.ts')) ||
        fs.existsSync(path.join(root, 'vite.config.js')) ||
        fs.existsSync(path.join(root, 'vite.config.mjs'));

    // Import Vite
    const vite = await import('vite');

    if (hasViteConfig) {
        // User has their own vite.config - use it directly
        // They should have ssgPlugin() configured already
        console.log('📦 Using existing vite.config\n');

        const server = await vite.createServer({
            root,
            server: {
                port: options.port,
                host: options.host,
                open: options.open,
            },
        });

        await server.listen();
        server.printUrls();
    } else {
        // Zero-config mode - configure everything automatically
        console.log('📦 Zero-config mode enabled\n');

        // Try to import @sigx/vite plugin
        let sigxPlugin: ((...args: any[]) => any) | undefined;
        try {
            const sigxVite = await import('@sigx/vite');
            sigxPlugin = sigxVite.sigxPlugin;
        } catch {
            console.warn('⚠️  @sigx/vite not found, JSX transform may not work');
            console.warn('   Install with: npm install @sigx/vite\n');
        }

        // Build plugins array
        const plugins: any[] = [];

        // Add Tailwind CSS if available
        try {
            // @ts-expect-error - Optional dependency
            const tailwind = await import('@tailwindcss/vite');
            plugins.push(tailwind.default());
        } catch {
            // Tailwind not installed, skip
        }

        // Add SignalX plugin if available
        if (sigxPlugin) {
            plugins.push(sigxPlugin());
        }

        // Add SSG plugin
        plugins.push(...ssgPlugin({ configPath: options.configPath }));

        const server = await vite.createServer({
            root,
            plugins,
            // Vite 8 uses oxc instead of esbuild for JSX transforms
            oxc: {
                jsx: {
                    runtime: 'automatic',
                    importSource: 'sigx',
                }
            },
            server: {
                port: options.port ?? 5173,
                host: options.host,
                open: options.open,
            },
        });

        await server.listen();
        server.printUrls();
    }
}

/**
 * Preview the production build
 */
export async function preview(options: DevOptions = {}): Promise<void> {
    const root = process.cwd();

    console.log('\n👀 @sigx/ssg - Preview server...\n');

    const vite = await import('vite');

    const server = await vite.preview({
        root,
        preview: {
            port: options.port ?? 4173,
            host: options.host,
            open: options.open,
        },
    });

    server.printUrls();
    console.log('\n');
}
