/**
 * Route resolver
 *
 * Resolves dynamic routes by calling getStaticPaths() and generates
 * the full list of static paths to render.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SSGRoute, SSGConfig, StaticPath, PageModule } from '../types';
import { isDynamicRoute, expandDynamicRoute, extractParams } from './scanner';

/**
 * Result of resolving routes
 */
export interface ResolvedRoutes {
    /**
     * Static routes that can be rendered directly
     */
    staticRoutes: SSGRoute[];

    /**
     * Expanded dynamic routes with all parameter combinations
     */
    expandedRoutes: ExpandedRoute[];

    /**
     * Warnings encountered during resolution
     */
    warnings: string[];
}

/**
 * A dynamic route expanded with specific parameters
 */
export interface ExpandedRoute {
    /**
     * Original route with dynamic segments
     */
    originalRoute: SSGRoute;

    /**
     * Fully resolved path (e.g., /blog/hello-world)
     */
    path: string;

    /**
     * Parameters used to resolve this path
     */
    params: Record<string, string>;

    /**
     * Optional props to pass to the page
     */
    props?: Record<string, unknown>;
}

/**
 * Resolve all routes and expand dynamic routes using getStaticPaths
 */
export async function resolveRoutes(
    routes: SSGRoute[],
    config: SSGConfig,
    root: string
): Promise<ResolvedRoutes> {
    const staticRoutes: SSGRoute[] = [];
    const expandedRoutes: ExpandedRoute[] = [];
    const warnings: string[] = [];

    for (const route of routes) {
        if (isDynamicRoute(route)) {
            // Dynamic route: need to call getStaticPaths
            try {
                const expanded = await expandRoute(route, root);
                expandedRoutes.push(...expanded);
            } catch (err) {
                const paramNames = extractParams(route.path).join(', ');
                warnings.push(
                    `Route ${route.path} has dynamic segments [${paramNames}] but no getStaticPaths() export. ` +
                        `This route will be skipped during static generation.`
                );
            }
        } else {
            // Static route: can be rendered directly
            staticRoutes.push(route);
        }
    }

    return { staticRoutes, expandedRoutes, warnings };
}

/**
 * Expand a dynamic route by loading the module and calling getStaticPaths
 */
async function expandRoute(route: SSGRoute, root: string): Promise<ExpandedRoute[]> {
    // Load the page module
    const moduleUrl = pathToFileURL(route.file).href;
    const pageModule = (await import(moduleUrl)) as PageModule;

    // Check for getStaticPaths export
    if (!pageModule.getStaticPaths) {
        throw new Error(`No getStaticPaths export found in ${route.file}`);
    }

    // Call getStaticPaths
    const staticPaths = await pageModule.getStaticPaths();

    // Validate paths
    const paramNames = extractParams(route.path);
    const expanded: ExpandedRoute[] = [];

    for (const staticPath of staticPaths) {
        // Validate that all required params are provided
        for (const paramName of paramNames) {
            if (!(paramName in staticPath.params)) {
                throw new Error(
                    `getStaticPaths() in ${route.file} is missing required param "${paramName}" for route ${route.path}`
                );
            }
        }

        // Expand the path
        const resolvedPaths = expandDynamicRoute(route, [staticPath]);

        for (const resolvedPath of resolvedPaths) {
            expanded.push({
                originalRoute: route,
                path: resolvedPath,
                params: staticPath.params,
                props: staticPath.props,
            });
        }
    }

    return expanded;
}

/**
 * Build a complete list of all paths to render
 */
export function getAllPaths(resolved: ResolvedRoutes): Array<{
    path: string;
    route: SSGRoute;
    params: Record<string, string>;
    props?: Record<string, unknown>;
}> {
    const allPaths: Array<{
        path: string;
        route: SSGRoute;
        params: Record<string, string>;
        props?: Record<string, unknown>;
    }> = [];

    // Add static routes
    for (const route of resolved.staticRoutes) {
        allPaths.push({
            path: route.path,
            route,
            params: {},
        });
    }

    // Add expanded dynamic routes
    for (const expanded of resolved.expandedRoutes) {
        allPaths.push({
            path: expanded.path,
            route: expanded.originalRoute,
            params: expanded.params,
            props: expanded.props,
        });
    }

    return allPaths;
}

/**
 * Match a path against a route pattern
 */
export function matchRoute(
    routePath: string,
    urlPath: string
): { match: boolean; params: Record<string, string> } {
    const routeSegments = routePath.split('/').filter(Boolean);
    const urlSegments = urlPath.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    let routeIdx = 0;
    let urlIdx = 0;

    while (routeIdx < routeSegments.length) {
        const routeSegment = routeSegments[routeIdx];

        // Catch-all segment
        if (routeSegment.startsWith('*')) {
            const paramName = routeSegment.slice(1);
            // Capture remaining segments
            params[paramName] = urlSegments.slice(urlIdx).join('/');
            return { match: true, params };
        }

        // No more URL segments but route expects more
        if (urlIdx >= urlSegments.length) {
            // Check if remaining route segments are optional
            if (routeSegment.endsWith('?')) {
                routeIdx++;
                continue;
            }
            return { match: false, params: {} };
        }

        const urlSegment = urlSegments[urlIdx];

        // Dynamic segment
        if (routeSegment.startsWith(':')) {
            const paramName = routeSegment.slice(1).replace('?', '');
            params[paramName] = urlSegment;
            routeIdx++;
            urlIdx++;
            continue;
        }

        // Static segment
        if (routeSegment !== urlSegment) {
            return { match: false, params: {} };
        }

        routeIdx++;
        urlIdx++;
    }

    // Check if all URL segments were consumed
    if (urlIdx < urlSegments.length) {
        return { match: false, params: {} };
    }

    return { match: true, params };
}
