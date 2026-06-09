/**
 * SSG Build CLI
 *
 * Static site generation build process:
 * 1. Load configuration
 * 2. Scan routes and expand dynamic paths
 * 3. Build with Vite for production
 * 4. Render each route to static HTML
 * 5. Write output files
 * 6. Generate sitemap and robots.txt
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { SSGConfig, BuildOptions, BuildResult, PageBuildResult, SSGRoute, PageModule } from './types';
import { loadConfig, resolveConfigPaths } from './config';
import { scanPages, isDynamicRoute, extractParams, expandDynamicRoute } from './routing/index';
import { discoverLayouts } from './layouts/index';
import { writeSitemap } from './sitemap';
import { generateHeadTags } from './head';
import {
    detectCustomEntries,
    generateClientEntry,
    generateServerEntry,
    generateProductionHtmlTemplate,
    VIRTUAL_CLIENT_ID,
    VIRTUAL_SERVER_ID,
} from './vite/virtual-entries';

/**
 * Build static site
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
    const startTime = Date.now();
    const root = process.cwd();
    const warnings: string[] = [];
    const pages: PageBuildResult[] = [];

    console.log('\n🚀 @sigx/ssg - Building static site...\n');

    // Step 1: Load configuration
    console.log('📦 Loading configuration...');
    const config = await loadConfig(options.configPath);
    const resolvedConfig = resolveConfigPaths(config, root);

    // Inherit Vite's `base` when the SSG config doesn't set one, so the
    // sitemap and post-build steps share the prefix Vite uses for assets.
    if (!resolvedConfig.base || resolvedConfig.base === '/') {
        try {
            const viteForBase = await import('vite');
            const viteResolved = await viteForBase.resolveConfig({ root }, 'build');
            if (viteResolved.base && viteResolved.base !== '/') {
                resolvedConfig.base = viteResolved.base;
            }
        } catch {
            // Vite config not loadable here — continue with default '/'.
        }
    }

    // Step 2: Scan routes
    console.log('🔍 Scanning pages...');
    const routes = await scanPages(resolvedConfig, root);
    console.log(`   Found ${routes.length} page(s)`);

    // Step 3: Discover layouts
    console.log('📐 Discovering layouts...');
    const layouts = await discoverLayouts(resolvedConfig, root);
    console.log(`   Found ${layouts.length} layout(s)`);

    // Step 4: Detect entry points
    const entryDetection = detectCustomEntries(root, resolvedConfig);
    if (entryDetection.useVirtualClient || entryDetection.useVirtualServer) {
        console.log('📦 Using zero-config mode');
        if (entryDetection.useVirtualClient) console.log('   → Virtual client entry');
        if (entryDetection.useVirtualServer) console.log('   → Virtual server entry');
        if (entryDetection.useVirtualHtml) console.log('   → Virtual HTML template');
    }

    // Get entry points (may create temp files for virtual entries)
    const clientEntry = await getClientEntryPoint(resolvedConfig, root);
    const ssrEntry = await getSSREntryPoint(resolvedConfig, root);

    // Always write HTML template for the build (either generated or updated from custom)
    // This ensures Vite processes it and outputs index.html
    const htmlTemplatePath = path.join(root, 'index.html');
    let cleanupHtml = false;
    let originalHtmlContent: string | null = null;
    
    // Save original HTML content if we're modifying a custom one
    if (!entryDetection.useVirtualHtml && fsSync.existsSync(htmlTemplatePath)) {
        originalHtmlContent = fsSync.readFileSync(htmlTemplatePath, 'utf-8');
    }
    
    const htmlContent = await getHtmlTemplate(resolvedConfig, root, clientEntry);
    fsSync.writeFileSync(htmlTemplatePath, htmlContent, 'utf-8');
    cleanupHtml = entryDetection.useVirtualHtml; // Only cleanup (delete) if we generated it

    // Step 5: Build with Vite
    console.log('🔨 Building with Vite...');
    const vite = await import('vite');

    try {
        // Build client bundle
        // Note: We don't empty the outDir since vite build may have already run
        // Always use HTML as input so Vite outputs index.html properly
        const clientInput = htmlTemplatePath;
        
        await vite.build({
            root,
            mode: 'production',
            build: {
                outDir: resolvedConfig.outDir,
                emptyOutDir: false,
                ssrManifest: true,
                rollupOptions: {
                    input: clientInput,
                },
            },
            logLevel: options.verbose ? 'info' : 'warn',
        });

        // Build SSR bundle
        const ssrOutDir = path.join(resolvedConfig.outDir!, '.ssg');
        await vite.build({
            root,
            mode: 'production',
            build: {
                outDir: ssrOutDir,
                ssr: true,
                rollupOptions: {
                    input: ssrEntry,
                },
            },
            logLevel: options.verbose ? 'info' : 'warn',
        });

        // Step 6: Collect all paths to render
        console.log('📝 Collecting paths to render...');
        const pathsToRender = await collectPaths(routes, root, warnings);
        console.log(`   ${pathsToRender.length} path(s) to render`);

        // Pre-create all output directories to avoid mkdir contention during parallel rendering
        const outputDirs = new Set<string>();
        for (const pathInfo of pathsToRender) {
            const outputPath = getOutputPath(pathInfo.path, resolvedConfig.outDir!);
            outputDirs.add(path.dirname(outputPath));
        }
        await Promise.all(
            Array.from(outputDirs).map(dir => fs.mkdir(dir, { recursive: true }))
        );

        // Step 7: Render each path to HTML
        console.log('🎨 Rendering pages...');

        // Determine the SSR entry output name (based on input file name)
        const ssrEntryBasename = path.basename(ssrEntry, path.extname(ssrEntry));
        const ssrEntryName = ssrEntryBasename + '.js';

        // Pre-load the SSR module once for all pages
        const entryPath = path.join(ssrOutDir, ssrEntryName);
        const entryModule = await import(pathToFileURL(entryPath).href);

        // Load HTML template once
        const templatePath = path.join(resolvedConfig.outDir!, 'index.html');
        const template = await fs.readFile(templatePath, 'utf-8');

        // Parallel rendering configuration - higher concurrency since rendering is CPU-bound
        const CONCURRENCY = options.concurrency ?? 20; // Number of pages to render in parallel
        const verbose = options.verbose ?? false;

        interface RenderResult {
            pathInfo: PathToRender;
            html: string;
            outputPath: string;
            renderTime: number;
        }

        // Render a single page (CPU-bound, no I/O)
        async function renderPage(pathInfo: PathToRender): Promise<RenderResult | null> {
            const renderStart = Date.now();

            try {
                // Render the app
                const appHtml = await entryModule.render(pathInfo.path, {
                    params: pathInfo.params,
                    props: pathInfo.props,
                });

                // Inject into template
                let html = template.replace('<!--app-html-->', appHtml);
                const headTags = generateHeadTags(pathInfo, resolvedConfig);
                html = html.replace('<!--head-tags-->', headTags);

                const outputPath = getOutputPath(pathInfo.path, resolvedConfig.outDir!);
                const renderTime = Date.now() - renderStart;

                return { pathInfo, html, outputPath, renderTime };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`   ❌ ${pathInfo.path}: ${errorMessage}`);
                warnings.push(`Failed to render ${pathInfo.path}: ${errorMessage}`);
                return null;
            }
        }

        // Render all pages in parallel batches (CPU-bound, no I/O)
        console.log('   Phase 1: Rendering...');
        const renderPhaseStart = Date.now();
        const renderResults: RenderResult[] = [];
        
        for (let i = 0; i < pathsToRender.length; i += CONCURRENCY) {
            const batch = pathsToRender.slice(i, i + CONCURRENCY);
            const results = await Promise.all(batch.map(renderPage));
            
            for (const result of results) {
                if (result) {
                    renderResults.push(result);
                }
            }
        }
        const renderPhaseDuration = Date.now() - renderPhaseStart;
        console.log(`   Phase 1 complete: ${renderResults.length} pages in ${renderPhaseDuration}ms (${Math.round(renderPhaseDuration / renderResults.length)}ms avg)`);

        // Write all files in parallel with limited concurrency
        console.log('   Phase 2: Writing files...');
        const writePhaseStart = Date.now();
        const WRITE_CONCURRENCY = 10; // Limit parallel writes to reduce I/O contention
        
        for (let i = 0; i < renderResults.length; i += WRITE_CONCURRENCY) {
            const batch = renderResults.slice(i, i + WRITE_CONCURRENCY);
            await Promise.all(batch.map(async (result) => {
                await fs.writeFile(result.outputPath, result.html, 'utf-8');
                const size = Buffer.byteLength(result.html, 'utf-8');

                pages.push({
                    path: result.pathInfo.path,
                    file: result.outputPath,
                    time: result.renderTime,
                    size,
                });
                
                if (verbose) {
                    console.log(`   ✓ ${result.pathInfo.path} (${result.renderTime}ms, ${formatBytes(size)})`);
                }
            }));
        }
        const writePhaseDuration = Date.now() - writePhaseStart;
        console.log(`   Phase 2 complete: ${renderResults.length} files in ${writePhaseDuration}ms`);
        
        // Summary (non-verbose)
        if (!verbose) {
            console.log(`   ✓ Rendered ${renderResults.length} pages`);
        }

        // Step 8: Clean up SSR build
        await fs.rm(ssrOutDir, { recursive: true, force: true });

        // Step 9: Generate sitemap and robots.txt
        if (pages.length > 0) {
            console.log('🗺️  Generating sitemap...');
            await writeSitemap(pages, resolvedConfig, resolvedConfig.outDir!);
            console.log('   ✓ sitemap.xml');
            console.log('   ✓ robots.txt');
        }

    } finally {
        // Clean up temporary entry files
        await cleanupTempEntries(root);
        
        // Clean up or restore HTML template
        if (cleanupHtml) {
            // We generated a virtual HTML, remove it
            try {
                await fs.unlink(htmlTemplatePath);
            } catch {
                // Ignore
            }
        } else if (originalHtmlContent !== null) {
            // We modified a custom HTML, restore the original
            try {
                await fs.writeFile(htmlTemplatePath, originalHtmlContent, 'utf-8');
            } catch {
                // Ignore
            }
        }
    }

    // Done
    const totalTime = Date.now() - startTime;

    console.log(`\n✅ Built ${pages.length} page(s) in ${totalTime}ms`);

    if (warnings.length > 0) {
        console.log(`\n⚠️  ${warnings.length} warning(s):`);
        for (const warning of warnings) {
            console.log(`   - ${warning}`);
        }
    }

    console.log(`\n📁 Output: ${resolvedConfig.outDir}\n`);

    return {
        pages,
        totalTime,
        warnings,
    };
}

/**
 * Path information for rendering
 */
interface PathToRender {
    path: string;
    route: SSGRoute;
    params: Record<string, string>;
    props?: Record<string, unknown>;
}

/**
 * Collect all paths to render, expanding dynamic routes
 */
async function collectPaths(
    routes: SSGRoute[],
    root: string,
    warnings: string[]
): Promise<PathToRender[]> {
    const paths: PathToRender[] = [];

    for (const route of routes) {
        if (isDynamicRoute(route)) {
            // Load module and call getStaticPaths
            try {
                const moduleUrl = pathToFileURL(route.file).href;
                const pageModule = (await import(moduleUrl)) as PageModule;

                if (!pageModule.getStaticPaths) {
                    const params = extractParams(route.path).join(', ');
                    console.warn(
                        `\n⚠️  SSG102: Dynamic route missing getStaticPaths()\n` +
                        `   📁 ${route.file}\n` +
                        `   Route: ${route.path} (params: ${params})\n` +
                        `   💡 Export getStaticPaths() to generate static pages:\n\n` +
                        `      export async function getStaticPaths() {\n` +
                        `          return [{ params: { ${params.split(', ')[0]}: 'value' } }];\n` +
                        `      }\n`
                    );
                    warnings.push(
                        `Route ${route.path} has dynamic segments [${params}] but no getStaticPaths() export. Skipping.`
                    );
                    continue;
                }

                const staticPaths = await pageModule.getStaticPaths();

                for (const staticPath of staticPaths) {
                    const expandedPaths = expandDynamicRoute(route, [staticPath]);
                    for (const expandedPath of expandedPaths) {
                        paths.push({
                            path: expandedPath,
                            route,
                            params: staticPath.params,
                            props: staticPath.props,
                        });
                    }
                }
            } catch (err) {
                warnings.push(`Failed to load ${route.file}: ${err}`);
            }
        } else {
            paths.push({
                path: route.path,
                route,
                params: {},
            });
        }
    }

    return paths;
}

/**
 * Render a page to HTML
 */
async function renderPage(
    pathInfo: PathToRender,
    config: SSGConfig,
    ssrOutDir: string,
    ssrEntryName: string
): Promise<string> {
    // Load the SSR entry module
    // This should export a render function that returns HTML string
    const entryPath = path.join(ssrOutDir, ssrEntryName);
    const entryModule = await import(pathToFileURL(entryPath).href);

    // Render the app - the entry module's render function handles SSR
    const appHtml = await entryModule.render(pathInfo.path, {
        params: pathInfo.params,
        props: pathInfo.props,
    });

    // Load HTML template
    const templatePath = path.join(config.outDir!, 'index.html');
    let template = await fs.readFile(templatePath, 'utf-8');

    // Inject app HTML
    template = template.replace('<!--app-html-->', appHtml);

    // Inject head tags if any
    const headTags = generateHeadTags(pathInfo, config);
    template = template.replace('<!--head-tags-->', headTags);

    return template;
}

/**
 * Get output file path for a URL path.
 *
 * - `/`         → `<outDir>/index.html`
 * - `/about`    → `<outDir>/about/index.html`
 * - `/foo.html` → `<outDir>/foo.html`
 */
function getOutputPath(urlPath: string, outDir: string): string {
    const normalized = urlPath.replace(/^\//, '').replace(/\/$/, '');

    if (!normalized) {
        return path.join(outDir, 'index.html');
    }

    if (normalized.endsWith('.html')) {
        return path.join(outDir, normalized);
    }

    return path.join(outDir, normalized, 'index.html');
}

/**
 * Get SSR entry point
 * Returns virtual module ID if no custom entry exists
 */
async function getSSREntryPoint(config: SSGConfig, root: string): Promise<string> {
    // Check for custom entry points
    const detection = detectCustomEntries(root, config);
    
    if (!detection.useVirtualServer && detection.customServerPath) {
        return detection.customServerPath;
    }

    // Use virtual server entry - we need to write a temp file for the build
    // because Rollup input must be a real file path
    const virtualServerCode = generateServerEntry(config);
    const tempServerPath = path.join(root, '.ssg-temp-entry-server.tsx');
    fsSync.writeFileSync(tempServerPath, virtualServerCode, 'utf-8');
    
    return tempServerPath;
}

/**
 * Get client entry point
 * Returns virtual module ID if no custom entry exists
 */
async function getClientEntryPoint(config: SSGConfig, root: string): Promise<string> {
    const detection = detectCustomEntries(root, config);
    
    if (!detection.useVirtualClient && detection.customClientPath) {
        return detection.customClientPath;
    }

    // Use virtual client entry - write a temp file
    const virtualClientCode = generateClientEntry(config, detection);
    const tempClientPath = path.join(root, '.ssg-temp-entry-client.tsx');
    fsSync.writeFileSync(tempClientPath, virtualClientCode, 'utf-8');
    
    return tempClientPath;
}

/**
 * Clean up temporary entry files
 */
async function cleanupTempEntries(root: string): Promise<void> {
    const tempFiles = [
        path.join(root, '.ssg-temp-entry-server.tsx'),
        path.join(root, '.ssg-temp-entry-client.tsx'),
    ];
    
    for (const file of tempFiles) {
        try {
            await fs.unlink(file);
        } catch {
            // Ignore if file doesn't exist
        }
    }
}

/**
 * Get or generate HTML template
 */
async function getHtmlTemplate(config: SSGConfig, root: string, clientEntryPath: string): Promise<string> {
    const detection = detectCustomEntries(root, config);
    
    if (!detection.useVirtualHtml && detection.customHtmlPath) {
        // Read custom HTML and update the script src to point to the temp entry file
        let html = await fs.readFile(detection.customHtmlPath, 'utf-8');
        // Replace any virtual SSG client paths with the actual temp entry path
        // Use relative path from root for the script src
        const relativePath = './' + path.relative(root, clientEntryPath).replace(/\\/g, '/');
        html = html.replace(
            /<script([^>]*)\s+src=["']?\/@ssg\/client\.tsx["']?/g,
            `<script$1 src="${relativePath}"`
        );
        return html;
    }

    // Generate virtual HTML template
    return generateProductionHtmlTemplate(config, clientEntryPath);
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

