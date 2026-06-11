/**
 * Virtual module generator for routes
 *
 * Generates the virtual:ssg-routes module that exports all routes
 * for use by the router.
 */

import type { SSGRoute, SSGConfig } from '../types';
import { scanPages } from './scanner';

/**
 * Virtual module ID for SSG routes
 */
export const VIRTUAL_ROUTES_ID = 'virtual:ssg-routes';
export const RESOLVED_VIRTUAL_ROUTES_ID = '\0' + VIRTUAL_ROUTES_ID;

/**
 * Normalize file path to use forward slashes (for ES module imports)
 */
function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Fallback layout for a route: its collection's `layout` when the route
 * lives under a collection path that sets one (#51), else the config
 * default. Frontmatter/`export const layout` always wins at runtime.
 */
function fallbackLayout(routePath: string, config: SSGConfig): string {
    let best: { layout: string; length: number } | undefined;
    for (const collection of Object.values(config.collections ?? {})) {
        if (!collection.layout) continue;
        const prefix = collection.path.replace(/\/+$/, '');
        if (routePath === prefix || routePath.startsWith(prefix + '/')) {
            // Longest matching prefix wins — nested collections (/docs/api
            // inside /docs) must pick the most specific layout.
            if (!best || prefix.length > best.length) {
                best = { layout: collection.layout, length: prefix.length };
            }
        }
    }
    return best?.layout ?? config.defaultLayout ?? 'default';
}

/**
 * Generate the virtual routes module code
 */
export function generateRoutesModule(routes: SSGRoute[], config: SSGConfig): string {
    const imports: string[] = [];
    const routeDefinitions: string[] = [];

    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const componentName = `Page${i}`;
        const metaName = `meta${i}`;
        const normalizedFile = normalizePath(route.file);

        // Import the full module to access both default export and named exports
        imports.push(`import * as ${componentName}Module from '${normalizedFile}';`);

        // Build meta from module exports with safe access (avoid Rollup warnings)
        // For TSX pages, meta is a named export
        // For MDX pages, frontmatter might be attached to the default export
        // Also include headings for table of contents (exported by MDX plugin)
        imports.push(
            `const ${metaName} = { ...('meta' in ${componentName}Module ? ${componentName}Module.meta : ${componentName}Module.default?.frontmatter || ${JSON.stringify(route.meta || {})}), headings: 'headings' in ${componentName}Module ? ${componentName}Module.headings : [] };`
        );
        imports.push(
            `const ${componentName} = ${componentName}Module.default || ${componentName}Module;`
        );

        routeDefinitions.push(`
    {
        path: '${route.path}',
        name: '${route.name}',
        file: '${normalizedFile}',
        component: ${componentName},
        meta: ${metaName},
        layout: ${metaName}.layout || '${fallbackLayout(route.path, config)}',
        getStaticPaths: import.meta.env.SSR && 'getStaticPaths' in ${componentName}Module ? ${componentName}Module.getStaticPaths : undefined,
    }`);
    }

    return `
${imports.join('\n')}

const routes = [${routeDefinitions.join(',')}
];

export default routes;
`;
}

/**
 * Generate lazy-loading routes module (for development with HMR)
 */
export function generateLazyRoutesModule(routes: SSGRoute[], config: SSGConfig): string {
    const imports: string[] = [];
    const routeDefinitions: string[] = [];

    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const componentName = `Page${i}`;
        const metaName = `meta${i}`;
        const normalizedFile = normalizePath(route.file);

        // Import the module to read meta/frontmatter for layout resolution
        imports.push(`import * as ${componentName}Module from '${normalizedFile}';`);
        // Build meta with safe access to avoid Rollup warnings about missing exports
        imports.push(
            `const ${metaName} = { ...('meta' in ${componentName}Module ? ${componentName}Module.meta : ${componentName}Module.default?.frontmatter || ${JSON.stringify(route.meta || {})}), headings: 'headings' in ${componentName}Module ? ${componentName}Module.headings : [] };`
        );

        routeDefinitions.push(`
    {
        path: '${route.path}',
        name: '${route.name}',
        file: '${normalizedFile}',
        component: () => import('${normalizedFile}'),
        meta: ${metaName},
        layout: ${metaName}.layout || '${fallbackLayout(route.path, config)}',
    }`);
    }

    return `
${imports.join('\n')}

const routes = [${routeDefinitions.join(',')}
];

export default routes;
`;
}

/**
 * Create a module loader for routes
 */
export async function loadRoutesModule(
    config: SSGConfig,
    root: string
): Promise<{ routes: SSGRoute[]; code: string }> {
    const routes = await scanPages(config, root);
    const code = generateRoutesModule(routes, config);

    return { routes, code };
}
