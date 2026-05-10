/**
 * SSG Vite Plugin
 *
 * Main Vite plugin for @sigx/ssg that integrates:
 * - File-based routing with virtual modules
 * - Layout system
 * - MDX processing
 * - HMR for development
 * - Zero-config entry point generation
 */

import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import type { SSGConfig } from '../types';
import { defineSSGConfig, loadConfig } from '../config';
import { scanPages } from '../routing/scanner';
import { generateRoutesModule, generateLazyRoutesModule, VIRTUAL_ROUTES_ID, RESOLVED_VIRTUAL_ROUTES_ID } from '../routing/virtual';
import { generateNavigationModule, VIRTUAL_NAVIGATION_ID, RESOLVED_VIRTUAL_NAVIGATION_ID } from '../routing/virtual-navigation';
import { discoverLayouts } from '../layouts/resolver';
import { generateLayoutsModule, VIRTUAL_LAYOUTS_ID, RESOLVED_VIRTUAL_LAYOUTS_ID } from '../layouts/virtual';
import { mdxPlugin } from '../mdx/plugin';
import { parseFrontmatter } from '../mdx/frontmatter';
import {
    detectCustomEntries,
    generateClientEntry,
    generateServerEntry,
    generateHtmlTemplate,
    VIRTUAL_CLIENT_ID,
    RESOLVED_VIRTUAL_CLIENT_ID,
    VIRTUAL_SERVER_ID,
    RESOLVED_VIRTUAL_SERVER_ID,
    SSG_CLIENT_ENTRY_PATH,
    type EntryDetectionResult,
} from './virtual-entries';

/**
 * SSG Plugin options
 */
export interface SSGPluginOptions extends Partial<SSGConfig> {
    /**
     * Path to ssg.config.ts
     */
    configPath?: string;
    
    /**
     * Enable built-in MDX processing. Set to false if using external MDX plugin.
     * @default true
     */
    enableMdx?: boolean;
}

/**
 * Virtual module for SSG config
 */
const VIRTUAL_CONFIG_ID = 'virtual:ssg-config';
const RESOLVED_VIRTUAL_CONFIG_ID = '\0' + VIRTUAL_CONFIG_ID;

/**
 * Create the SSG Vite plugin
 */
export function ssgPlugin(options: SSGPluginOptions = {}): Plugin[] {
    let config: ResolvedConfig;
    let ssgConfig: SSGConfig;
    let root: string;
    let server: ViteDevServer | undefined;
    let entryDetection: EntryDetectionResult;

    // Cache for virtual modules
    let routesCache: { routes: any[]; code: string } | null = null;
    let layoutsCache: { layouts: any[]; code: string } | null = null;
    let navigationCache: { code: string } | null = null;
    
    // Cache for frontmatter hashes to detect changes
    const frontmatterHashCache = new Map<string, string>();

    const mainPlugin: Plugin = {
        name: 'sigx-ssg',
        enforce: 'pre',

        async configResolved(resolvedConfig) {
            config = resolvedConfig;
            root = resolvedConfig.root;

            // Load SSG config - always try to load from file first
            const fileConfig = await loadConfig(options.configPath);

            // Merge file config with plugin options (plugin options take precedence).
            // Inherit Vite's `base` when the SSG config doesn't set one, so the
            // generated router and sitemap stay in sync with the asset URLs Vite
            // emits (e.g. when deploying under a sub-path like /docs/).
            const merged = { ...fileConfig, ...options };
            if ((merged.base == null || merged.base === '/') && resolvedConfig.base && resolvedConfig.base !== '/') {
                merged.base = resolvedConfig.base;
            }
            ssgConfig = defineSSGConfig(merged);

            // Detect custom entry points
            entryDetection = detectCustomEntries(root, ssgConfig);

            // Log zero-config mode status
            if (entryDetection.useVirtualClient || entryDetection.useVirtualServer) {
                console.log('📦 @sigx/ssg: Using zero-config mode');
                if (entryDetection.useVirtualClient) {
                    console.log('   → Virtual client entry');
                }
                if (entryDetection.useVirtualServer) {
                    console.log('   → Virtual server entry');
                }
                if (entryDetection.globalCssPath) {
                    console.log(`   → Auto-importing ${entryDetection.globalCssPath}`);
                }
            }
        },

        configureServer(devServer) {
            server = devServer;

            // Watch pages and layouts directories for changes
            const pagesDir = path.resolve(root, ssgConfig.pages || 'src/pages');
            const layoutsDir = path.resolve(root, ssgConfig.layouts || 'src/layouts');
            const contentDir = path.resolve(root, ssgConfig.content || 'src/content');

            // Clear caches and trigger HMR on file changes
            devServer.watcher.on('add', (file) => {
                if (file.startsWith(pagesDir)) {
                    routesCache = null;
                    navigationCache = null;
                    invalidateModule(RESOLVED_VIRTUAL_ROUTES_ID);
                    invalidateModule(RESOLVED_VIRTUAL_NAVIGATION_ID);
                } else if (file.startsWith(layoutsDir)) {
                    layoutsCache = null;
                    invalidateModule(RESOLVED_VIRTUAL_LAYOUTS_ID);
                }
            });

            devServer.watcher.on('unlink', (file) => {
                if (file.startsWith(pagesDir)) {
                    routesCache = null;
                    navigationCache = null;
                    // Clean up frontmatter hash cache
                    frontmatterHashCache.delete(file);
                    invalidateModule(RESOLVED_VIRTUAL_ROUTES_ID);
                    invalidateModule(RESOLVED_VIRTUAL_NAVIGATION_ID);
                } else if (file.startsWith(layoutsDir)) {
                    layoutsCache = null;
                    invalidateModule(RESOLVED_VIRTUAL_LAYOUTS_ID);
                }
            });

            // Handle MDX/MD file content changes for frontmatter updates
            devServer.watcher.on('change', async (file) => {
                if (!file.startsWith(pagesDir)) return;
                if (!/\.mdx?$/.test(file)) return;
                
                try {
                    const content = await fs.promises.readFile(file, 'utf-8');
                    const { data: newFrontmatter } = parseFrontmatter(content);
                    const newHash = JSON.stringify(newFrontmatter);
                    const oldHash = frontmatterHashCache.get(file);
                    
                    // Update the cache
                    frontmatterHashCache.set(file, newHash);
                    
                    // If frontmatter changed, invalidate navigation (titles, categories may have changed)
                    if (oldHash !== undefined && oldHash !== newHash) {
                        navigationCache = null;
                        routesCache = null;
                        
                        const navMod = devServer.moduleGraph.getModuleById(RESOLVED_VIRTUAL_NAVIGATION_ID);
                        if (navMod) {
                            devServer.moduleGraph.invalidateModule(navMod);
                        }
                        
                        const routesMod = devServer.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ROUTES_ID);
                        if (routesMod) {
                            devServer.moduleGraph.invalidateModule(routesMod);
                        }
                        
                        // Send HMR update for navigation changes
                        devServer.ws.send({ type: 'full-reload' });
                    }
                } catch (err) {
                    // File read error, ignore
                }
            });

            function invalidateModule(id: string) {
                const mod = devServer.moduleGraph.getModuleById(id);
                if (mod) {
                    devServer.moduleGraph.invalidateModule(mod);
                    devServer.ws.send({ type: 'full-reload' });
                }
            }

            // Serve virtual HTML template if no index.html exists
            if (entryDetection.useVirtualHtml) {
                devServer.middlewares.use((req, res, next) => {
                    // Skip virtual modules and special Vite paths
                    if (req.url?.startsWith('/@') || 
                        req.url?.startsWith('/__') || 
                        req.url?.includes('virtual:') ||
                        req.url?.includes('node_modules') ||
                        req.url?.startsWith('/@vite') ||
                        req.url?.startsWith('/@fs')) {
                        return next();
                    }
                    
                    // Only handle requests for HTML pages (not assets with extensions)
                    if (req.url && (req.url === '/' || !req.url.includes('.'))) {
                        const html = generateHtmlTemplate(ssgConfig);
                        // Transform HTML through Vite for HMR injection
                        devServer.transformIndexHtml(req.url, html).then((transformedHtml) => {
                            res.setHeader('Content-Type', 'text/html');
                            res.end(transformedHtml);
                        }).catch(next);
                        return;
                    }
                    next();
                });
            }
        },

        resolveId(id) {
            // Handle virtual modules
            if (id === VIRTUAL_ROUTES_ID) {
                return RESOLVED_VIRTUAL_ROUTES_ID;
            }
            if (id === VIRTUAL_LAYOUTS_ID) {
                return RESOLVED_VIRTUAL_LAYOUTS_ID;
            }
            if (id === VIRTUAL_CONFIG_ID) {
                return RESOLVED_VIRTUAL_CONFIG_ID;
            }
            if (id === VIRTUAL_NAVIGATION_ID) {
                return RESOLVED_VIRTUAL_NAVIGATION_ID;
            }
            // Handle virtual entry points (both formats)
            if (id === VIRTUAL_CLIENT_ID || id === SSG_CLIENT_ENTRY_PATH) {
                return RESOLVED_VIRTUAL_CLIENT_ID;
            }
            if (id === VIRTUAL_SERVER_ID) {
                return RESOLVED_VIRTUAL_SERVER_ID;
            }
            return null;
        },

        async load(id) {
            // Generate virtual routes module
            if (id === RESOLVED_VIRTUAL_ROUTES_ID) {
                if (!routesCache) {
                    const routes = await scanPages(ssgConfig, root);
                    // Use lazy loading in dev mode for proper HMR and MDX processing
                    const code = config.command === 'serve'
                        ? generateLazyRoutesModule(routes, ssgConfig)
                        : generateRoutesModule(routes, ssgConfig);
                    routesCache = { routes, code };
                }
                return routesCache.code;
            }

            // Generate virtual layouts module
            if (id === RESOLVED_VIRTUAL_LAYOUTS_ID) {
                if (!layoutsCache) {
                    const layouts = await discoverLayouts(ssgConfig, root);
                    const code = generateLayoutsModule(layouts, ssgConfig);
                    layoutsCache = { layouts, code };
                }
                return layoutsCache.code;
            }

            // Generate virtual navigation module
            if (id === RESOLVED_VIRTUAL_NAVIGATION_ID) {
                if (!navigationCache) {
                    // Ensure routes are loaded (reuse cache if available)
                    if (!routesCache) {
                        const routes = await scanPages(ssgConfig, root);
                        const routesCode = config.command === 'serve'
                            ? generateLazyRoutesModule(routes, ssgConfig)
                            : generateRoutesModule(routes, ssgConfig);
                        routesCache = { routes, code: routesCode };
                    }
                    const isDev = config.command === 'serve';
                    const code = generateNavigationModule(routesCache.routes, ssgConfig, isDev);
                    navigationCache = { code };
                }
                return navigationCache.code;
            }

            // Generate virtual config module
            if (id === RESOLVED_VIRTUAL_CONFIG_ID) {
                return `export default ${JSON.stringify(ssgConfig)};`;
            }

            // Generate virtual client entry (needs JSX transform)
            if (id === RESOLVED_VIRTUAL_CLIENT_ID) {
                const code = generateClientEntry(ssgConfig, entryDetection);
                const esbuild = await import('esbuild');
                const result = await esbuild.transform(code, {
                    loader: 'tsx',
                    jsx: 'automatic',
                    jsxImportSource: 'sigx',
                });
                return result.code;
            }

            // Generate virtual server entry (needs JSX transform)
            if (id === RESOLVED_VIRTUAL_SERVER_ID) {
                const code = generateServerEntry(ssgConfig);
                const esbuild = await import('esbuild');
                const result = await esbuild.transform(code, {
                    loader: 'tsx',
                    jsx: 'automatic',
                    jsxImportSource: 'sigx',
                });
                return result.code;
            }

            return null;
        },

        // Handle HMR for layouts and pages
        async handleHotUpdate({ file, server }) {
            const layoutsDir = path.resolve(root, ssgConfig.layouts || 'src/layouts');
            const pagesDir = path.resolve(root, ssgConfig.pages || 'src/pages');

            if (file.startsWith(layoutsDir)) {
                // Clear layout cache
                layoutsCache = null;

                // Invalidate the virtual layouts module
                const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_LAYOUTS_ID);
                if (mod) {
                    server.moduleGraph.invalidateModule(mod);
                }

                // Also reload pages that use this layout
                return [];
            }

            // Handle MDX/MD file changes in pages directory
            if (file.startsWith(pagesDir) && /\.mdx?$/.test(file)) {
                // The MDX plugin handles the transform and HMR code injection.
                // We just need to ensure the module is properly invalidated.
                // Vite will handle the rest via the injected import.meta.hot.accept()
                
                // Return undefined to let Vite handle the standard HMR flow
                // The MDX file already has import.meta.hot.accept() injected
                return undefined;
            }

            return undefined;
        },
    };

    // Combine with MDX plugin if enabled (default: true)
    const enableMdx = options.enableMdx !== false;
    
    if (enableMdx) {
        const mdx = mdxPlugin({
            markdown: options.markdown,
            ssgConfig: undefined as any, // Will be set by configResolved
        });
        return [mainPlugin, mdx];
    }
    
    return [mainPlugin];
}

/**
 * Export the plugin as default
 */
export default ssgPlugin;
