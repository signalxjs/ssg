/**
 * Path collection for the static build (internal module).
 *
 * Deliberately NOT re-exported from index.ts or reachable via the package
 * `exports` map — `build.ts` is a public entrypoint (`@sigx/ssg/build`), so
 * internals used by it (and its tests) live here instead.
 */

import { pathToFileURL } from 'node:url';
import type { SSGRoute, PageModule } from './types';
import { isDynamicRoute, extractParams, expandDynamicRoute } from './routing/index';

/**
 * Path information for rendering
 */
export interface PathToRender {
    path: string;
    route: SSGRoute;
    params: Record<string, string>;
    props?: Record<string, unknown>;
}

/**
 * Collect all paths to render, expanding dynamic routes.
 *
 * Routes with `draft: true` frontmatter are excluded (they are thereby also
 * absent from the sitemap, which is generated from rendered pages) unless
 * `options.drafts` is set.
 */
export async function collectPaths(
    routes: SSGRoute[],
    root: string,
    warnings: string[],
    options: { drafts?: boolean } = {}
): Promise<PathToRender[]> {
    const paths: PathToRender[] = [];

    for (const route of routes) {
        if (route.meta?.draft && !options.drafts) {
            continue;
        }

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
