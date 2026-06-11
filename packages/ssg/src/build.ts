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
import type { InlineConfig } from 'vite';
import type { SSGConfig, BuildOptions, BuildResult, PageBuildResult } from './types';
import { loadConfig, resolveConfigPaths } from './config';
import { scanPages } from './routing/index';
import { collectPaths, type PathToRender } from './collect-paths';
import { injectIntoTemplate } from './template';
import { registerProcessCleanup } from './cleanup';
import { hasViteConfigFile, assembleZeroConfigPlugins, ZERO_CONFIG_OXC } from './vite/zero-config';
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

    // Restore the user's index.html / remove temp entries on SIGINT/SIGTERM
    // too — the `finally` below doesn't run when the process is killed (#52).
    const restoreProjectFiles = () => {
        if (cleanupHtml) {
            try { fsSync.unlinkSync(htmlTemplatePath); } catch { /* ignore */ }
        } else if (originalHtmlContent !== null) {
            try { fsSync.writeFileSync(htmlTemplatePath, originalHtmlContent, 'utf-8'); } catch { /* ignore */ }
        }
        cleanupTempEntriesSync(root);
    };
    const unregisterCleanup = registerProcessCleanup(restoreProjectFiles);

    // Step 5: Build with Vite
    console.log('🔨 Building with Vite...');
    const vite = await import('vite');
    let ssrOutDir: string | undefined;

    try {
        // Build client bundle
        // Note: We don't empty the outDir since vite build may have already run
        // Always use HTML as input so Vite outputs index.html properly
        const clientInput = htmlTemplatePath;

        const buildConfigs = createViteBuildConfigs(
            resolvedConfig,
            root,
            clientInput,
            ssrEntry,
            options.verbose
        );

        // Without a vite.config the SSG plugins (which resolve the virtual
        // modules the entries import) have to be injected, exactly like the
        // zero-config dev server does (#52).
        if (!hasViteConfigFile(root)) {
            console.log('📦 Zero-config Vite build (no vite.config found)');
            buildConfigs.client.plugins = await assembleZeroConfigPlugins(options.configPath);
            buildConfigs.ssr.plugins = await assembleZeroConfigPlugins(options.configPath);
            (buildConfigs.client as any).oxc = ZERO_CONFIG_OXC;
            (buildConfigs.ssr as any).oxc = ZERO_CONFIG_OXC;
        }

        await vite.build(buildConfigs.client);

        // Build SSR bundle
        ssrOutDir = buildConfigs.ssr.build!.outDir!;
        await vite.build(buildConfigs.ssr);

        // Pre-load the SSR module once — it renders every page AND resolves
        // getStaticPaths for dynamic routes (raw .tsx/.mdx sources cannot be
        // import()ed from Node, #46).
        const ssrEntryBasename = path.basename(ssrEntry, path.extname(ssrEntry));
        const ssrEntryName = ssrEntryBasename + '.js';
        const entryPath = path.join(ssrOutDir, ssrEntryName);
        const entryModule = await import(pathToFileURL(entryPath).href);

        // Step 6: Collect all paths to render
        console.log('📝 Collecting paths to render...');
        const loadStaticPaths =
            typeof entryModule.getStaticPathsForRoute === 'function'
                ? (route: { path: string }) => entryModule.getStaticPathsForRoute(route.path)
                : undefined; // Custom SSR entry without the export: collectPaths falls back to source import
        const pathsToRender = await collectPaths(routes, root, warnings, {
            drafts: options.drafts,
            loadStaticPaths,
        });
        console.log(`   ${pathsToRender.length} path(s) to render`);
        const skippedDraftRoutes = routes.filter((route) => route.meta?.draft).length;
        if (skippedDraftRoutes > 0 && !options.drafts) {
            console.log(`   Skipped ${skippedDraftRoutes} draft route(s) (build with --drafts to include)`);
        }

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

        // Pages whose render rejected or produced an SSR error marker — the
        // build must NOT exit 0 with pages missing or broken (#52).
        const renderFailures: Array<{ path: string; message: string }> = [];

        // Render a single page (CPU-bound, no I/O)
        async function renderPage(pathInfo: PathToRender): Promise<RenderResult | null> {
            const renderStart = Date.now();

            try {
                // Render the app
                const appHtml = await entryModule.render(pathInfo.path, {
                    params: pathInfo.params,
                    props: pathInfo.props,
                });

                // The SSR renderer swallows component errors into marker
                // comments — a page rendering `<!--ssr-error…-->` instead of
                // content is a failed render, not a success.
                if (typeof appHtml === 'string' && appHtml.includes('<!--ssr-error')) {
                    throw new Error('component threw during SSR (the output contains an <!--ssr-error--> marker)');
                }

                // Inject into template (replacer-safe, see template.ts)
                const headTags = generateHeadTags(pathInfo, resolvedConfig);
                const html = injectIntoTemplate(template, appHtml, headTags);

                const outputPath = getOutputPath(pathInfo.path, resolvedConfig.outDir!);
                const renderTime = Date.now() - renderStart;

                return { pathInfo, html, outputPath, renderTime };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`   ❌ ${pathInfo.path}: ${errorMessage}`);
                renderFailures.push({ path: pathInfo.path, message: errorMessage });
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

        // All failures are reported above; now fail the build — deploying a
        // site with silently missing pages is never OK (#52).
        if (renderFailures.length > 0) {
            const { SSGError, ErrorCodes } = await import('./errors');
            const list = renderFailures
                .map((f) => `   - ${f.path}: ${f.message}`)
                .join('\n');
            throw new SSGError(
                `${renderFailures.length} page(s) failed to render:\n${list}`,
                {
                    code: ErrorCodes.BUILD_RENDER_FAILED,
                    suggestion: 'Fix the page errors above. The build does not skip failed pages.',
                }
            );
        }

        const renderPhaseDuration = Date.now() - renderPhaseStart;
        const avgRender = renderResults.length > 0 ? ` (${Math.round(renderPhaseDuration / renderResults.length)}ms avg)` : '';
        console.log(`   Phase 1 complete: ${renderResults.length} pages in ${renderPhaseDuration}ms${avgRender}`);

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

        // Step 8: Generate sitemap and robots.txt
        if (pages.length > 0) {
            console.log('🗺️  Generating sitemap...');
            await writeSitemap(pages, resolvedConfig, resolvedConfig.outDir!);
            console.log('   ✓ sitemap.xml');
            console.log('   ✓ robots.txt');
        }

    } finally {
        unregisterCleanup();
        // Restore the user's index.html and remove temporary entry files
        restoreProjectFiles();
        // Remove the SSR build dir on failed builds too — stale dist/.ssg
        // artifacts must not accumulate
        if (ssrOutDir) {
            await fs.rm(ssrOutDir, { recursive: true, force: true }).catch(() => {});
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
 * Vite configs for the client and SSR production builds.
 *
 * `base` must be passed explicitly: the SSG config's base (set in
 * ssg.config.ts or inherited from vite.config) has to reach the asset URLs
 * Vite emits, or subpath deploys break (#49). Exported for tests.
 */
export function createViteBuildConfigs(
    config: SSGConfig,
    root: string,
    clientInput: string,
    ssrEntry: string,
    verbose?: boolean
): { client: InlineConfig; ssr: InlineConfig } {
    // Blank base/outDir are treated as unset, matching the inheritance logic
    // in build() (`!resolvedConfig.base || resolvedConfig.base === '/'`).
    const base = config.base?.trim() ? config.base : '/';
    const outDir = config.outDir?.trim() ? config.outDir : 'dist';
    const logLevel = verbose ? 'info' : 'warn';

    return {
        client: {
            root,
            base,
            mode: 'production',
            build: {
                outDir,
                emptyOutDir: false,
                ssrManifest: true,
                rollupOptions: {
                    input: clientInput,
                },
            },
            logLevel,
        },
        ssr: {
            root,
            base,
            mode: 'production',
            build: {
                outDir: path.join(outDir, '.ssg'),
                ssr: true,
                rollupOptions: {
                    input: ssrEntry,
                },
            },
            logLevel,
        },
    };
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
 * Clean up temporary entry files. Sync so it can also run from a signal
 * handler (#52).
 */
function cleanupTempEntriesSync(root: string): void {
    const tempFiles = [
        path.join(root, '.ssg-temp-entry-server.tsx'),
        path.join(root, '.ssg-temp-entry-client.tsx'),
    ];

    for (const file of tempFiles) {
        try {
            fsSync.unlinkSync(file);
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

