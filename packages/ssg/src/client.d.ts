/**
 * Ambient type declarations for the virtual modules emitted by the
 * `@sigx/ssg` Vite plugin. Add `"@sigx/ssg/virtual"` to `compilerOptions.types`
 * in `tsconfig.json` to pick these up.
 */

declare module 'virtual:ssg-routes' {
    /** Route record produced by the file-based router scanner. */
    export interface SSGRouteRecord {
        path: string;
        name: string;
        file: string;
        component: unknown;
        meta: Record<string, unknown> & { headings?: unknown };
        layout?: string;
    }

    const routes: SSGRouteRecord[];
    export default routes;
}

declare module 'virtual:ssg-navigation' {
    import type { NavSection, CollectionConfig } from '@sigx/ssg';

    /** Navigation tree for a single collection. */
    export interface CollectionNavigation {
        sidebar: NavSection[];
    }

    /** Map of collection name → navigation tree. */
    export const navigation: Record<string, CollectionNavigation>;

    /** Look up navigation for a specific collection. */
    export function getCollectionNav(name: string): CollectionNavigation | undefined;

    /** Detect which collection a route path belongs to. */
    export function detectCollection(path: string): string | undefined;

    /** Get the sidebar sections for a collection (empty if not found). */
    export function getSidebar(name: string): NavSection[];

    const _default: {
        navigation: typeof navigation;
        collections: Record<string, CollectionConfig>;
        getCollectionNav: typeof getCollectionNav;
        detectCollection: typeof detectCollection;
        getSidebar: typeof getSidebar;
    };
    export default _default;
}

declare module 'virtual:generated-layouts' {
    /** Annotates routes with their resolved layout component. */
    export function setupLayouts<T>(routes: T): T;

    /** Layout-aware router component that preserves layouts across navigations. */
    export const LayoutRouter: unknown;
}
