/**
 * SSG Configuration helper
 */

import path from 'node:path';
import type { SSGConfig } from './types';

/**
 * Define SSG configuration with type safety
 *
 * @example
 * ```ts
 * // ssg.config.ts
 * import { defineSSGConfig } from '@sigx/ssg';
 *
 * export default defineSSGConfig({
 *     pages: 'src/pages',
 *     layouts: 'src/layouts',
 *     theme: '@sigx/ssg-theme-daisyui',
 *     site: {
 *         title: 'My Site',
 *         description: 'A SignalX-powered static site'
 *     }
 * });
 * ```
 */
export function defineSSGConfig(config: SSGConfig): SSGConfig {
    return {
        // Defaults
        pages: 'src/pages',
        layouts: 'src/layouts',
        content: 'src/content',
        defaultLayout: 'default',
        outDir: 'dist',
        base: '/',
        trailingSlash: 'always',
        // Zero-config defaults
        prefetch: true,
        spaNavigation: true,
        // User overrides
        ...config,
        // Merge nested objects
        site: {
            lang: 'en',
            ...config.site,
        },
        markdown: {
            shiki: true,
            ...config.markdown,
        },
        toc: {
            minLevel: 2,
            maxLevel: 3,
            ...config.toc,
        },
    };
}

/**
 * Load SSG config from file
 */
export async function loadConfig(configPath?: string): Promise<SSGConfig> {
    const fsPath = await import('node:path');
    const fs = await import('node:fs');
    const { pathToFileURL } = await import('node:url');

    // Find config file
    const cwd = process.cwd();
    const possiblePaths = configPath
        ? [fsPath.resolve(cwd, configPath)]
        : [
              fsPath.resolve(cwd, 'ssg.config.ts'),
              fsPath.resolve(cwd, 'ssg.config.js'),
              fsPath.resolve(cwd, 'ssg.config.mjs'),
          ];

    let foundPath: string | null = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            foundPath = p;
            break;
        }
    }

    if (!foundPath) {
        console.warn('No ssg.config found, using defaults');
        return defineSSGConfig({});
    }

    try {
        // For TypeScript files, compile with esbuild first
        if (foundPath.endsWith('.ts')) {
            const esbuild = await import('esbuild');

            // BUNDLE (don't just type-strip): a config importing relative .ts
            // helpers must work on every supported Node, not only versions
            // with native type stripping — and non-erasable syntax (enums)
            // must work everywhere (#96). Bare package imports stay external
            // and resolve at runtime from the temp file next to the config —
            // enforced via a resolve plugin because esbuild's
            // `packages: 'external'` still inlines pnpm-workspace-symlinked
            // packages.
            const result = await esbuild.build({
                entryPoints: [foundPath],
                bundle: true,
                format: 'esm',
                platform: 'node',
                write: false,
                sourcemap: false,
                plugins: [
                    {
                        name: 'ssg-external-bare-imports',
                        setup(pluginBuild) {
                            pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
                                args.kind === 'entry-point' ? undefined : { path: args.path, external: true }
                            );
                        },
                    },
                ],
            });

            const configDir = fsPath.dirname(foundPath);
            const localTempFile = fsPath.join(configDir, `.ssg-config-temp-${Date.now()}.mjs`);

            fs.writeFileSync(localTempFile, result.outputFiles[0].text);

            try {
                const configModule = await import(pathToFileURL(localTempFile).href);
                return defineSSGConfig(configModule.default || configModule);
            } finally {
                // Clean up temp file
                try {
                    fs.unlinkSync(localTempFile);
                } catch {
                    // Ignore cleanup errors
                }
            }
        }

        // For JS files, import directly
        const configModule = await import(pathToFileURL(foundPath).href);
        return defineSSGConfig(configModule.default || configModule);
    } catch (err) {
        // A broken config must fail loudly — silently falling back to the
        // defaults builds the site with the wrong dirs/site metadata (#52).
        const { SSGError, ErrorCodes } = await import('./errors');
        throw new SSGError(`Failed to load config from ${foundPath}`, {
            code: ErrorCodes.CONFIG_INVALID,
            file: foundPath,
            suggestion: 'Fix the error below in your ssg.config — the build does not fall back to defaults.',
            cause: err instanceof Error ? err : new Error(String(err)),
        });
    }
}

/**
 * Resolve paths in config to absolute paths
 */
export function resolveConfigPaths(config: SSGConfig, root: string): SSGConfig {
    return {
        ...config,
        pages: path.resolve(root, config.pages || 'src/pages'),
        layouts: path.resolve(root, config.layouts || 'src/layouts'),
        content: path.resolve(root, config.content || 'src/content'),
        outDir: path.resolve(root, config.outDir || 'dist'),
    };
}
