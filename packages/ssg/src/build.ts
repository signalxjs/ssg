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
import { collectPaths, getOutputPath, type PathToRender } from './collect-paths';
import { injectIntoTemplate } from './template';
import { registerProcessCleanup } from './cleanup';
import { hasViteConfigFile, assembleZeroConfigPlugins, ZERO_CONFIG_OXC } from './vite/zero-config';
import { discoverLayouts } from './layouts/index';
import { writeSitemap } from './sitemap';
import { isInsideDir } from './vite/paths';
import { generateHeadTags, pagePropsScript } from './head';
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
    // Rendered HTML per page, collected only when `search` is enabled (#62) —
    // the index extracts visible text from the final HTML.
    const searchDocs: Array<{ page: PageBuildResult; html: string }> = [];
    // Same shape, separate gate: link validation needs every page's HTML (#99).
    const linkDocs: Array<{ path: string; html: string }> = [];

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

    // Fold in the theme's config contributions (head tags, css, default
    // layout) — site config wins (#60).
    const { resolveThemeConfig } = await import('./theme');
    const themedConfig = await resolveThemeConfig(resolvedConfig, root);
    Object.assign(resolvedConfig, themedConfig);

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

    // Save the original whenever the file EXISTS — even when the build uses
    // a generated template (e.g. `htmlTemplate: false` with an index.html
    // present), the user's file must be restored, never deleted (#51).
    let originalHtmlContent: string | null = null;
    if (fsSync.existsSync(htmlTemplatePath)) {
        originalHtmlContent = fsSync.readFileSync(htmlTemplatePath, 'utf-8');
    }

    const htmlContent = await getHtmlTemplate(resolvedConfig, root, clientEntry);
    fsSync.writeFileSync(htmlTemplatePath, htmlContent, 'utf-8');

    // Restore the user's index.html / remove temp entries on SIGINT/SIGTERM
    // too — the `finally` below doesn't run when the process is killed (#52).
    const restoreProjectFiles = () => {
        if (originalHtmlContent !== null) {
            // The file pre-existed (custom template, or forced-virtual) — restore it
            try { fsSync.writeFileSync(htmlTemplatePath, originalHtmlContent, 'utf-8'); } catch { /* ignore */ }
        } else {
            // We created it for the build — remove it
            try { fsSync.unlinkSync(htmlTemplatePath); } catch { /* ignore */ }
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

                // Inject into template (replacer-safe, see template.ts).
                // Pages with getStaticPaths props also embed them so the
                // client hydrates with the same props the server used (#73).
                const headTags =
                    generateHeadTags(pathInfo, resolvedConfig) +
                    pagePropsScript(pathInfo.path, pathInfo.props);
                let html = injectIntoTemplate(template, appHtml, headTags);

                // transformHtml hook (#58) — runs inside the try, so a
                // throwing hook fails the build like a failed render.
                if (resolvedConfig.hooks?.transformHtml) {
                    html = await resolvedConfig.hooks.transformHtml(html, {
                        path: pathInfo.path,
                        params: pathInfo.params,
                        props: pathInfo.props,
                        meta: pathInfo.route.meta,
                        route: pathInfo.route,
                    });
                    if (typeof html !== 'string') {
                        throw new Error(`hooks.transformHtml must return a string (got ${typeof html} for ${pathInfo.path})`);
                    }
                }

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

                const pageResult: PageBuildResult = {
                    path: result.pathInfo.path,
                    file: result.outputPath,
                    time: result.renderTime,
                    size,
                    meta: result.pathInfo.route.meta,
                };
                pages.push(pageResult);
                if (resolvedConfig.search) searchDocs.push({ page: pageResult, html: result.html });
                if ((resolvedConfig.linkCheck ?? 'warn') !== 'off') linkDocs.push({ path: pageResult.path, html: result.html });

                // onPageRendered hook (#58) — page written, final HTML in hand
                if (resolvedConfig.hooks?.onPageRendered) {
                    await resolvedConfig.hooks.onPageRendered({ ...pageResult, html: result.html });
                }
                
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

        // Step 8: Generate sitemap and robots.txt (config.sitemap carries
        // the SitemapOptions; `false` disables generation entirely) (#56)
        if (pages.length > 0 && resolvedConfig.sitemap !== false) {
            if (!resolvedConfig.site?.url) {
                console.warn(
                    '⚠️  Skipping sitemap.xml/robots.txt: set `site.url` in your ssg.config — ' +
                    'sitemap <loc> entries must be absolute URLs (or set `sitemap: false` to silence this).'
                );
                warnings.push('Sitemap skipped: site.url is not configured.');
            } else {
                console.log('🗺️  Generating sitemap...');
                await writeSitemap(pages, resolvedConfig, resolvedConfig.outDir!, resolvedConfig.sitemap ?? {});
                console.log('   ✓ sitemap.xml');
                console.log('   ✓ robots.txt');
            }
        }

        // Static redirects (#61)
        if (resolvedConfig.redirects && Object.keys(resolvedConfig.redirects).length > 0) {
            console.log('↪️  Writing redirects...');
            const { writeRedirects } = await import('./redirects');
            await writeRedirects(
                resolvedConfig.redirects,
                resolvedConfig,
                resolvedConfig.outDir!,
                pages.map((p) => p.path) // exact guard: only THIS run's pages (#120)
            );
            console.log(`   ✓ ${Object.keys(resolvedConfig.redirects).length} redirect(s) + _redirects`);
        }

        // Default 404 page (#65) — only when the site doesn't render its own
        // (the /404 page convention from #57 takes precedence).
        const has404 = pages.some((p) => p.path === '/404' || p.path === '/404.html');
        // A 404.html already in outDir (e.g. copied from public/) wins too.
        const notFoundPath = path.join(resolvedConfig.outDir!, '404.html');
        if (!has404 && !fsSync.existsSync(notFoundPath)) {
            const { generateDefault404 } = await import('./default-404');
            await fs.writeFile(notFoundPath, generateDefault404(resolvedConfig), 'utf-8');
            console.log('   ✓ 404.html (default — add a /404 page to customize)');
        }

        // Internal link & anchor validation (#99)
        const linkCheckMode = resolvedConfig.linkCheck ?? 'warn';
        if (linkCheckMode !== 'off' && linkDocs.length > 0) {
            console.log('🔗 Checking internal links...');
            const { checkLinks, formatLinkCheckReport } = await import('./link-check');
            const { SSGError, ErrorCodes } = await import('./errors');
            const fsSyncMod = await import('node:fs');
            const broken = checkLinks(linkDocs, {
                base: resolvedConfig.base,
                redirects: resolvedConfig.redirects,
                // Assets from public/ are already copied into outDir here.
                // Resolve inside outDir only — '..' segments must not let a
                // link validate against files outside the build output.
                fileExists: (p) => {
                    const resolved = path.resolve(resolvedConfig.outDir!, '.' + p);
                    if (!isInsideDir(resolvedConfig.outDir!, resolved)) return false;
                    return fsSyncMod.existsSync(resolved);
                },
            });
            if (broken.length === 0) {
                console.log('   ✓ all internal links resolve');
            } else {
                const report = formatLinkCheckReport(broken);
                if (linkCheckMode === 'error') {
                    throw new SSGError(`Link check failed — ${report}`, {
                        code: ErrorCodes.BUILD_LINK_CHECK_FAILED,
                        suggestion: "Fix the links above, or relax with linkCheck: 'warn'.",
                    });
                }
                console.warn(`⚠️  ${report}`);
                warnings.push(`${broken.length} broken internal link(s) — set linkCheck: 'error' to fail the build.`);
            }
        }

        // Built-in search index (#62)
        if (resolvedConfig.search) {
            console.log('🔍 Writing search index...');
            const { buildSearchIndex, writeSearchIndex } = await import('./search');
            const searchOptions = resolvedConfig.search === true ? {} : resolvedConfig.search;
            const entries = buildSearchIndex(searchDocs, searchOptions);
            await writeSearchIndex(entries, resolvedConfig.outDir!, searchOptions);
            console.log(`   ✓ ${searchOptions.output ?? 'search-index.json'} (${entries.length} pages)`);
        }

        // postBuild hook (#58) — everything is on disk; search indexes,
        // link checkers etc. run here.
        if (resolvedConfig.hooks?.postBuild) {
            console.log('🪝 Running postBuild hook...');
            await resolvedConfig.hooks.postBuild(
                { pages, warnings },
                { outDir: resolvedConfig.outDir!, config: resolvedConfig }
            );
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

