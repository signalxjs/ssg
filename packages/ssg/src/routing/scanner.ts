/**
 * File-based route scanner
 *
 * Scans a pages directory and generates route definitions from file paths.
 * Supports dynamic routes with [param] and catch-all with [...slug] patterns.
 */

import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs';
import type { SSGRoute, SSGConfig, PageMeta, ProgrammaticRoute } from '../types';
import { parseFrontmatter, extractTitleFromContent } from '../mdx/frontmatter';
import { extractTsxMeta } from './extract-meta';

/**
 * File extensions to treat as pages
 */
const PAGE_EXTENSIONS = ['.tsx', '.jsx', '.mdx', '.md'];

/**
 * Files/directories to exclude from routing
 * 
 * Only exclude common non-page folders at the ROOT of pages directory.
 * Nested folders like /docs/components/ are valid routes.
 */
const EXCLUDED_PATTERNS = [
    'components/**',   // Root-level components folder only
    'hooks/**',        // Root-level hooks folder only
    'utils/**',        // Root-level utils folder only
    'lib/**',          // Root-level lib folder only
    '**/_*',           // Files/folders starting with underscore (at any level)
    '**/*.test.*',
    '**/*.spec.*',
];

/**
 * Scan pages directory and generate routes
 */
export async function scanPages(config: SSGConfig, root: string): Promise<SSGRoute[]> {
    const pagesDir = path.resolve(root, config.pages || 'src/pages');

    // Find all page files
    const patterns = PAGE_EXTENSIONS.map(ext => `**/*${ext}`);
    const files = await fg(patterns, {
        cwd: pagesDir,
        ignore: EXCLUDED_PATTERNS,
        onlyFiles: true,
        absolute: false,
    });

    // Convert files to routes (with frontmatter extraction)
    const routes: SSGRoute[] = [];

    for (const file of files) {
        const route = await fileToRouteWithMeta(file, pagesDir);
        if (route) {
            routes.push(route);
        }
    }

    // Programmatic routes from config.routes (#59) — merged before the
    // specificity sort so dev, build, and navigation all see them.
    if (config.routes) {
        const programmatic = await config.routes({ config, root });
        for (const route of programmatic) {
            routes.push(normalizeProgrammaticRoute(route, routes, root));
        }
    }

    // Sort routes by specificity (static > dynamic > catch-all)
    return sortRoutes(routes);
}

/**
 * Validate a `config.routes` entry and shape it like a scanned route (#59):
 * absolute existing component file, leading-slash path, no collision with an
 * already-known route, and a derived name.
 */
function normalizeProgrammaticRoute(
    route: ProgrammaticRoute,
    existing: SSGRoute[],
    root: string
): SSGRoute {
    if (!route.path.startsWith('/')) {
        throw new Error(`routes: path "${route.path}" must start with "/".`);
    }
    // `/about` and `/about/` render to the same about/index.html — normalize
    // before the collision check so they can't silently overwrite each other.
    const routePath = route.path !== '/' ? route.path.replace(/\/+$/, '') : route.path;

    const file = path.isAbsolute(route.file) ? route.file : path.resolve(root, route.file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        throw new Error(`routes: component for "${routePath}" is not a file: ${route.file}`);
    }
    const collision = existing.find((r) => r.path === routePath);
    if (collision) {
        throw new Error(
            `routes: "${routePath}" collides with an existing page (${collision.file}). ` +
                `Remove the page or the programmatic route.`
        );
    }

    const normalized: SSGRoute = { path: routePath, file, name: pathToRouteName(routePath) };
    if (route.meta) normalized.meta = { ...route.meta };
    if (route.layout) {
        normalized.layout = route.layout;
        // The generated routes module resolves layouts from meta.layout —
        // mirror it there so `layout` actually takes effect.
        normalized.meta = { ...normalized.meta, layout: route.layout };
    }
    return normalized;
}

/**
 * Convert a file path to a route definition with frontmatter metadata
 */
async function fileToRouteWithMeta(filePath: string, pagesDir: string): Promise<SSGRoute | null> {
    const route = fileToRoute(filePath, pagesDir);
    if (!route) return null;

    // Extract frontmatter from MDX/MD files
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mdx' || ext === '.md') {
        try {
            const source = fs.readFileSync(route.file, 'utf-8');
            const { data, content: body } = parseFrontmatter(source);
            route.meta = data;

            // Fall back to the first H1 so pages titled only by content get
            // a real <title>/og:title instead of the site default (#55).
            // Search the body only — a `# comment` line inside the YAML
            // frontmatter block must not become the title.
            if (!route.meta.title) {
                const title = extractTitleFromContent(body);
                if (title) route.meta.title = title;
            }
        } catch (err) {
            // Ignore read errors - frontmatter just won't be available
        }
    } else if (ext === '.tsx' || ext === '.jsx') {
        // Extract `export const meta` statically (#205) so head tags, drafts,
        // sitemap overrides, llms and search see the same meta the rendered
        // page does. No H1 title fallback here — there is no markdown body.
        try {
            const source = fs.readFileSync(route.file, 'utf-8');
            const { meta, warning } = extractTsxMeta(source, route.file);
            if (meta) route.meta = meta;
            if (warning) console.warn(`⚠️  ${warning}`);
        } catch (err) {
            // Ignore read errors - meta just won't be available
        }
    }

    return route;
}

/**
 * Convert a file path to a route definition
 */
export function fileToRoute(filePath: string, pagesDir: string): SSGRoute | null {
    // Remove extension
    const ext = path.extname(filePath);
    let routePath = filePath.slice(0, -ext.length);

    // Handle index files
    if (routePath.endsWith('/index') || routePath === 'index') {
        routePath = routePath.replace(/\/?index$/, '') || '/';
    }

    // Convert file path to URL path
    routePath = filePathToRoutePath(routePath);

    // Generate route name from path
    const name = pathToRouteName(routePath);

    return {
        path: routePath.startsWith('/') ? routePath : `/${routePath}`,
        file: path.join(pagesDir, filePath),
        name,
    };
}

/**
 * Convert file path patterns to route path patterns
 *
 * Examples:
 *   blog/[slug] -> /blog/:slug
 *   docs/[...path] -> /docs/*path
 *   users/[id]/posts -> /users/:id/posts
 */
export function filePathToRoutePath(filePath: string): string {
    return filePath
        .split('/')
        .map(segment => {
            // Catch-all: [...slug] -> *slug
            if (segment.startsWith('[...') && segment.endsWith(']')) {
                const param = segment.slice(4, -1);
                return `*${param}`;
            }

            // Optional catch-all: [[...slug]] -> *slug (same behavior)
            if (segment.startsWith('[[...') && segment.endsWith(']]')) {
                const param = segment.slice(5, -2);
                return `*${param}`;
            }

            // Optional segment: [[id]] -> :id?
            // Must be checked before [id] — both prefixes match '['.
            if (segment.startsWith('[[') && segment.endsWith(']]')) {
                const param = segment.slice(2, -2);
                return `:${param}?`;
            }

            // Dynamic segment: [id] -> :id
            if (segment.startsWith('[') && segment.endsWith(']')) {
                const param = segment.slice(1, -1);
                return `:${param}`;
            }

            return segment;
        })
        .join('/');
}

/**
 * Convert route path to a route name
 *
 * Examples:
 *   / -> index
 *   /about -> about
 *   /blog/:slug -> blog-slug
 *   /docs/*path -> docs-path
 */
export function pathToRouteName(routePath: string): string {
    if (routePath === '/' || routePath === '') {
        return 'index';
    }

    return routePath
        .replace(/^\//, '') // Remove leading slash
        .replace(/\//g, '-') // Replace slashes with dashes
        .replace(/:/g, '') // Remove param colons
        .replace(/\*/g, '') // Remove wildcards
        .replace(/\?/g, '') // Remove optional markers
        .replace(/-+/g, '-') // Collapse multiple dashes
        .replace(/-$/, ''); // Remove trailing dash
}

/**
 * Sort routes by specificity
 *
 * Order:
 *   1. Static routes (most specific)
 *   2. Dynamic param routes
 *   3. Catch-all routes (least specific)
 *
 * Within each category, longer paths come first
 */
export function sortRoutes(routes: SSGRoute[]): SSGRoute[] {
    return routes.sort((a, b) => {
        const scoreA = getRouteScore(a.path);
        const scoreB = getRouteScore(b.path);

        // Higher score = more specific = should come first
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }

        // Same score: longer paths first
        return b.path.length - a.path.length;
    });
}

/**
 * Calculate specificity score for a route
 */
function getRouteScore(routePath: string): number {
    const segments = routePath.split('/').filter(Boolean);
    let score = 0;

    for (const segment of segments) {
        if (segment.startsWith('*')) {
            // Catch-all: lowest priority
            score += 1;
        } else if (segment.startsWith(':')) {
            // Dynamic param: medium priority
            score += 10;
        } else {
            // Static segment: highest priority
            score += 100;
        }
    }

    return score;
}

/**
 * Check if a route has dynamic segments
 */
export function isDynamicRoute(route: SSGRoute): boolean {
    return route.path.includes(':') || route.path.includes('*');
}

/**
 * Extract parameter names from a route path
 */
export function extractParams(routePath: string): string[] {
    const params: string[] = [];
    const segments = routePath.split('/');

    for (const segment of segments) {
        if (segment.startsWith(':')) {
            params.push(segment.slice(1).replace('?', ''));
        } else if (segment.startsWith('*')) {
            params.push(segment.slice(1));
        }
    }

    return params;
}

/**
 * Generate all static paths for a route using getStaticPaths
 */
export function expandDynamicRoute(
    route: SSGRoute,
    staticPaths: Array<{ params: Record<string, string> }>
): string[] {
    const paths: string[] = [];

    for (const { params } of staticPaths) {
        // Substitute segment-wise: string replace on the whole path corrupts
        // routes when one param name is a prefix of another (:id vs :id2) and
        // leaves the optional marker behind (:id? -> "x?").
        const segments: string[] = [];

        for (const segment of route.path.split('/')) {
            if (segment.startsWith(':')) {
                const optional = segment.endsWith('?');
                const name = optional ? segment.slice(1, -1) : segment.slice(1);
                const value = params[name];

                if (value !== undefined && value !== '') {
                    segments.push(value);
                } else if (optional) {
                    continue; // Absent optional param: drop the segment
                } else {
                    segments.push(segment); // No value provided: leave pattern as-is
                }
            } else if (segment.startsWith('*')) {
                const value = params[segment.slice(1)];
                segments.push(value !== undefined ? value : segment);
            } else {
                segments.push(segment);
            }
        }

        paths.push(segments.join('/') || '/');
    }

    return paths;
}
