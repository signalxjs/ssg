/**
 * Navigation generator for SSG
 *
 * Generates navigation structure from scanned routes based on
 * page frontmatter (category, order) or explicit configuration.
 */

import type { SSGRoute, SSGConfig, NavSection, NavItem, PageMeta, CollectionConfig } from '../types';

/**
 * Collection navigation result
 */
export interface CollectionNavigation {
    sidebar: NavSection[];
}

/**
 * Internal type for building navigation tree
 */
interface NavBuildContext {
    categories: Map<string, NavBuildCategory>;
    uncategorized: NavBuildItem[];
}

interface NavBuildCategory {
    title: string;
    order: number | undefined;
    items: NavBuildItem[];
    children: Map<string, NavBuildCategory>;
}

interface NavBuildItem {
    title: string;
    href: string;
    order: number;
}

/**
 * Whether a route belongs to a collection path. A page belongs only when its
 * route equals the collection path or sits under it on a path-segment
 * boundary — `/modules/updates-ui/x` is NOT under `/modules/updates` even
 * though the raw string is a prefix (signalxjs/ssg#143).
 */
export function isUnderCollectionPath(routePath: string, collectionPath: string): boolean {
    const prefix = collectionPath.replace(/\/+$/, '');
    return routePath === prefix || routePath.startsWith(prefix + '/');
}

/**
 * Generate navigation structure from routes for a specific collection path
 *
 * @param routes - Scanned SSG routes
 * @param collectionPath - Path prefix for the collection (e.g., '/docs')
 * @param showDrafts - Whether to show draft pages
 * @param isDev - Whether running in development mode
 * @param sectionOrder - Optional per-title sort weights
 * @param allCollectionPaths - All configured collection paths; when a route
 *   matches several, the longest path wins so a page is assigned to its most
 *   specific collection only (signalxjs/ssg#143)
 */
export function generateNavigation(
    routes: SSGRoute[],
    collectionPath: string,
    showDrafts: 'dev' | 'never',
    isDev: boolean,
    sectionOrder?: Record<string, number>,
    allCollectionPaths?: string[]
): CollectionNavigation {
    // Other collections nested more deeply than this one — a route under any
    // of these belongs to that more specific collection, not this one.
    const ownLength = collectionPath.replace(/\/+$/, '').length;
    const deeperPaths = (allCollectionPaths ?? []).filter(
        (p) => p.replace(/\/+$/, '').length > ownLength
    );

    // Filter routes for navigation
    const navRoutes = routes.filter((route) => {
        // Must be under collection path, on a segment boundary
        if (!isUnderCollectionPath(route.path, collectionPath)) {
            return false;
        }

        // A more specific (longer) collection claims this route instead.
        if (deeperPaths.some((p) => isUnderCollectionPath(route.path, p))) {
            return false;
        }

        const meta = route.meta || {};

        // Check sidebar flag (default true)
        if (meta.sidebar === false) {
            return false;
        }

        // Handle draft pages
        if (meta.draft) {
            if (showDrafts === 'never') {
                return false;
            }
            if (showDrafts === 'dev' && !isDev) {
                return false;
            }
        }

        return true;
    });

    // Build navigation structure
    const context: NavBuildContext = {
        categories: new Map(),
        uncategorized: [],
    };

    for (const route of navRoutes) {
        const meta = route.meta || {};
        const title = meta.title || routeToTitle(route.path);
        const order = typeof meta.order === 'number' ? meta.order : 999;
        const category = meta.category;

        const item: NavBuildItem = {
            title,
            href: route.path,
            order,
        };

        if (!category) {
            // No category - add to uncategorized
            context.uncategorized.push(item);
        } else if (typeof category === 'string') {
            // Single category
            addToCategory(context.categories, [category], item);
        } else if (Array.isArray(category)) {
            // Nested categories
            addToCategory(context.categories, category, item);
        }
    }

    // Convert to NavSection array
    const sidebar = buildSections(context, sectionOrder);

    return { sidebar };
}

/**
 * Add an item to a nested category structure
 */
function addToCategory(
    categories: Map<string, NavBuildCategory>,
    path: string[],
    item: NavBuildItem
): void {
    if (path.length === 0) {
        return;
    }

    const [first, ...rest] = path;

    let category = categories.get(first);
    if (!category) {
        category = {
            title: first,
            order: undefined,
            items: [],
            children: new Map(),
        };
        categories.set(first, category);
    }

    if (rest.length === 0) {
        // This is the target category
        category.items.push(item);
    } else {
        // Recurse into children
        addToCategory(category.children, rest, item);
    }
}

/**
 * Common section ordering for navigation
 * Used for both top-level sections and nested categories
 */
const SECTION_ORDER: Record<string, number> = {
    'Getting Started': 10,
    'Core Concepts': 20,
    'Core': 20,
    'Built-in Components': 30,
    'Components': 30,
    'Guides': 40,
    'Advanced': 50,
    'Ecosystem': 60,
    'API Reference': 70,
    'API': 70,
    'Reference': 80,
    // DaisyUI component categories (matching DaisyUI website)
    'Actions': 100,
    'Data Display': 110,
    'Navigation': 120,
    'Feedback': 130,
    'Data Input': 140,
    'Layout': 150,
    'Mockup': 160,
    'Other': 999,
};

/**
 * Get sort order for a section/category title. A custom per-title map
 * (navigation.sectionOrder, #60) wins over the built-in defaults.
 */
function getSectionOrder(
    title: string,
    explicitOrder?: number,
    sectionOrder?: Record<string, number>
): number {
    if (explicitOrder !== undefined) {
        return explicitOrder;
    }
    return sectionOrder?.[title] ?? SECTION_ORDER[title] ?? 50;
}

/**
 * Build NavSection array from context
 */
function buildSections(context: NavBuildContext, sectionOrder?: Record<string, number>): NavSection[] {
    const sections: NavSection[] = [];

    // Add categorized items
    for (const [, category] of context.categories) {
        sections.push(buildSection(category, sectionOrder));
    }

    // Add uncategorized items as a section if any exist
    if (context.uncategorized.length > 0) {
        sections.push({
            title: 'Other',
            items: context.uncategorized
                .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
                .map((item) => ({
                    title: item.title,
                    href: item.href,
                    order: item.order,
                })),
            order: 999,
        });
    }

    sections.sort((a, b) => {
        const orderA = getSectionOrder(a.title, a.order, sectionOrder);
        const orderB = getSectionOrder(b.title, b.order, sectionOrder);
        return orderA - orderB;
    });

    return sections;
}

/**
 * Build a NavSection from a category
 */
function buildSection(category: NavBuildCategory, sectionOrder?: Record<string, number>): NavSection {
    // Sort items
    const sortedItems = category.items
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
        .map((item) => ({
            title: item.title,
            href: item.href,
            order: item.order,
        }));

    // Build nested children
    const childSections: NavItem[] = [];
    for (const [, child] of category.children) {
        childSections.push(buildNestedSection(child));
    }

    // Merge items and child sections
    const items: NavItem[] = [...sortedItems];

    // Add nested sections as groups, sorted by section order
    for (const nested of childSections.sort((a, b) => {
        const orderA = getSectionOrder(a.title, a.order, sectionOrder);
        const orderB = getSectionOrder(b.title, b.order, sectionOrder);
        return orderA - orderB;
    })) {
        items.push(nested);
    }

    return {
        title: category.title,
        items,
        order: category.order,
    };
}

/**
 * Build a nested NavItem from a child category
 */
function buildNestedSection(category: NavBuildCategory): NavItem {
    const sortedItems = category.items
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
        .map((item) => ({
            title: item.title,
            href: item.href,
            order: item.order,
        }));

    // Recursively build children
    const childItems: NavItem[] = [];
    for (const [, child] of category.children) {
        childItems.push(buildNestedSection(child));
    }

    return {
        title: category.title,
        items: [...sortedItems, ...childItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))],
        order: category.order,
    };
}

/**
 * Convert route path to a display title
 *
 * @example '/docs/getting-started' -> 'Getting Started'
 * @example '/docs/api/router' -> 'Router'
 */
function routeToTitle(routePath: string): string {
    const segments = routePath.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || 'Home';

    return lastSegment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Merge explicit sidebar config with auto-generated navigation
 */
export function mergeNavigation(
    autoGenerated: NavSection[],
    explicit: NavSection[]
): NavSection[] {
    const merged = new Map<string, NavSection>();

    // Add auto-generated first
    for (const section of autoGenerated) {
        merged.set(section.title, section);
    }

    // Override/add explicit sections
    for (const section of explicit) {
        if (merged.has(section.title)) {
            // Merge items
            const existing = merged.get(section.title)!;
            merged.set(section.title, {
                ...existing,
                ...section,
                items: [...existing.items, ...section.items],
            });
        } else {
            merged.set(section.title, section);
        }
    }

    return Array.from(merged.values());
}

/**
 * Generate navigation for all collections
 *
 * @param routes - Scanned SSG routes
 * @param config - SSG configuration
 * @param isDev - Whether running in development mode
 * @returns Record mapping collection names to their navigation
 */
export function generateAllCollections(
    routes: SSGRoute[],
    config: SSGConfig,
    isDev: boolean
): Record<string, CollectionNavigation> {
    const collections = config.collections || {};
    const result: Record<string, CollectionNavigation> = {};
    const allCollectionPaths = Object.values(collections).map((c) => c.path);

    for (const [name, collectionConfig] of Object.entries(collections)) {
        const showDrafts = collectionConfig.showDrafts ?? config.navigation?.showDrafts ?? 'dev';
        // Per-collection order wins over the site-wide setting (#100).
        const sectionOrder = normalizeSectionOrder(
            collectionConfig.sectionOrder ?? config.navigation?.sectionOrder
        );
        result[name] = generateNavigation(
            routes,
            collectionConfig.path,
            showDrafts,
            isDev,
            sectionOrder,
            allCollectionPaths
        );
    }

    return result;
}

/**
 * Normalize a section order to the name → weight form (#100). A list maps
 * each title to a negative weight (position − length), so listed categories
 * always sort ahead of every built-in weight (10+) regardless of list
 * length, in list order; unlisted ones follow per the built-in defaults.
 */
export function normalizeSectionOrder(
    order?: Record<string, number> | string[]
): Record<string, number> | undefined {
    if (!order) return undefined;
    if (!Array.isArray(order)) return order;
    return Object.fromEntries(order.map((title, index) => [title, index - order.length]));
}

/**
 * Detect which collection a route path belongs to
 *
 * @param path - Current route path
 * @param collections - Collections configuration
 * @returns The collection name if found, undefined otherwise
 */
export function detectCollection(
    path: string,
    collections: Record<string, CollectionConfig>
): string | undefined {
    // Sort by path length descending to match most specific path first
    const sorted = Object.entries(collections).sort(
        ([, a], [, b]) => b.path.length - a.path.length
    );

    for (const [name, config] of sorted) {
        if (isUnderCollectionPath(path, config.path)) {
            return name;
        }
    }

    return undefined;
}
