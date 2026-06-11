/**
 * Path collection for the static build (internal module).
 *
 * Deliberately NOT re-exported from index.ts or reachable via the package
 * `exports` map — `build.ts` is a public entrypoint (`@sigx/ssg/build`), so
 * internals used by it (and its tests) live here instead.
 */

import { pathToFileURL } from 'node:url';
import type { SSGRoute, PageModule, StaticPath } from './types';
import { isDynamicRoute, extractParams, expandDynamicRoute } from './routing/index';
import { SSGError, ErrorCodes } from './errors';

/**
 * Path information for rendering
 */
export interface PathToRender {
    path: string;
    route: SSGRoute;
    params: Record<string, string>;
    props?: Record<string, unknown>;
}

export interface CollectPathsOptions {
    /** Include `draft: true` pages (excluded from production builds by default). */
    drafts?: boolean;

    /**
     * Resolve a dynamic route's getStaticPaths result from the built SSR
     * bundle (which has the page modules compiled in). Returns null when the
     * route has no getStaticPaths export. Without this loader the page module
     * is import()ed from source — which only works for plain .js pages; Node
     * cannot load .tsx/.mdx, so the build provides this loader (#46).
     */
    loadStaticPaths?: (route: SSGRoute) => Promise<StaticPath[] | null>;
}

/**
 * Collect all paths to render, expanding dynamic routes.
 *
 * Routes with `draft: true` frontmatter are excluded (they are thereby also
 * absent from the sitemap, which is generated from rendered pages) unless
 * `options.drafts` is set.
 *
 * A dynamic route whose getStaticPaths throws fails the build — silently
 * skipping it would deploy a site with the pages missing (#46).
 */
export async function collectPaths(
    routes: SSGRoute[],
    root: string,
    warnings: string[],
    options: CollectPathsOptions = {}
): Promise<PathToRender[]> {
    const paths: PathToRender[] = [];

    for (const route of routes) {
        if (route.meta?.draft && !options.drafts) {
            continue;
        }

        if (!isDynamicRoute(route)) {
            paths.push({
                path: route.path,
                route,
                params: {},
            });
            continue;
        }

        let staticPaths: StaticPath[] | null;
        try {
            if (options.loadStaticPaths) {
                staticPaths = await options.loadStaticPaths(route);
            } else {
                // Fallback (custom SSR entries without getStaticPathsForRoute):
                // import the page source directly. Only works for plain .js.
                const moduleUrl = pathToFileURL(route.file).href;
                const pageModule = (await import(moduleUrl)) as PageModule;
                staticPaths = pageModule.getStaticPaths
                    ? await pageModule.getStaticPaths()
                    : null;
            }
        } catch (err) {
            throw new SSGError(`Failed to resolve getStaticPaths for dynamic route ${route.path}`, {
                code: ErrorCodes.DYNAMIC_ROUTE_NO_PATHS,
                file: route.file,
                suggestion:
                    `Loading the page module or running its getStaticPaths() failed.\n` +
                    `   Fix the error below — the build does not skip dynamic routes silently.`,
                cause: err instanceof Error ? err : new Error(String(err)),
            });
        }

        if (!staticPaths) {
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
    }

    return paths;
}
