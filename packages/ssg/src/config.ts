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
        autoEntries: true,
        prefetch: true,
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
    const os = await import('node:os');

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
        // For TypeScript files, use esbuild to compile them first
        if (foundPath.endsWith('.ts')) {
            const esbuild = await import('esbuild');
            const tempDir = os.tmpdir();
            const tempFile = fsPath.join(tempDir, `ssg-config-${Date.now()}.mjs`);
            
            // Read and transform the TypeScript file
            const source = fs.readFileSync(foundPath, 'utf-8');
            
            // Transform: remove the import and defineSSGConfig wrapper
            // The config file typically does: export default defineSSGConfig({ ... })
            // We just need the config object, so we can transform it
            const result = await esbuild.transform(source, {
                loader: 'ts',
                format: 'esm',
            });
            
            // Write the transformed code to a temp file in the same directory as the config
            // This ensures relative imports and package resolution work correctly
            const configDir = fsPath.dirname(foundPath);
            const localTempFile = fsPath.join(configDir, `.ssg-config-temp-${Date.now()}.mjs`);
            
            fs.writeFileSync(localTempFile, result.code);
            
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
