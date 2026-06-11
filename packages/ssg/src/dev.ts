/**
 * SSG Dev Server
 *
 * Starts a Vite development server with SSG plugins pre-configured.
 * Provides a unified `ssg dev` command for zero-config development.
 */

import { loadConfig } from './config';
import { hasViteConfigFile, assembleZeroConfigPlugins, ZERO_CONFIG_OXC } from './vite/zero-config';

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

    // Load SSG config (fails loudly on a broken config file)
    await loadConfig(options.configPath);

    // Import Vite
    const vite = await import('vite');

    if (hasViteConfigFile(root)) {
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
        // Zero-config mode - configure everything automatically (shared with
        // the production build, see vite/zero-config.ts)
        console.log('📦 Zero-config mode enabled\n');

        const server = await vite.createServer({
            root,
            plugins: await assembleZeroConfigPlugins(options.configPath),
            // Vite 8 uses oxc instead of esbuild for JSX transforms
            oxc: ZERO_CONFIG_OXC,
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
