/**
 * @sigx/ssg - Static Site Generator for SignalX
 *
 * Core types and interfaces for the SSG system
 */

import type { ComponentFactory } from 'sigx';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * SSG Configuration options
 */
export interface SSGConfig {
    /**
     * Directory containing page files (relative to project root)
     * @default 'src/pages'
     */
    pages?: string;

    /**
     * Directory containing layout files (relative to project root)
     * @default 'src/layouts'
     */
    layouts?: string;

    /**
     * Directory containing content files (relative to project root)
     * @default 'src/content'
     */
    content?: string;

    /**
     * Theme package to use (e.g., '@sigx/ssg-theme-daisyui')
     * Theme provides default layouts and components
     */
    theme?: string;

    /**
     * Default layout to use when page doesn't specify one
     * @default 'default'
     */
    defaultLayout?: string;

    /**
     * Output directory for generated static files
     * @default 'dist'
     */
    outDir?: string;

    /**
     * Base URL for the site (e.g., '/docs/')
     * @default '/'
     */
    base?: string;

    /**
     * Site-wide metadata
     */
    site?: SiteConfig;

    /**
     * Markdown/MDX configuration
     */
    markdown?: MarkdownConfig;

    /**
     * Vite configuration overrides
     */
    vite?: Record<string, unknown>;

    // ========================================================================
    // Zero-Config Options
    // ========================================================================

    /**
     * Whether to auto-generate entry points when not found
     * @default true
     */
    autoEntries?: boolean;

    /**
     * Custom client entry path (overrides virtual entry detection)
     * Relative to project root
     */
    clientEntry?: string;

    /**
     * Additional imports to add to the virtual client entry
     * Useful for adding side-effect-only imports like '@sigx/live-code/client'
     * @example ['@sigx/live-code/client', './my-global-setup']
     */
    clientImports?: string[];

    /**
     * Custom server entry path (overrides virtual entry detection)
     * Relative to project root
     */
    serverEntry?: string;

    /**
     * HTML template path, or false to auto-generate
     * Relative to project root
     * @default 'index.html' if exists, otherwise auto-generated
     */
    htmlTemplate?: string | false;

    /**
     * Whether to auto-setup link prefetching
     * @default true
     */
    prefetch?: boolean | { delay?: number };

    // ========================================================================
    // Navigation Options
    // ========================================================================

    /**
     * Collections configuration for multi-collection support.
     * Each collection has its own path prefix and generates its own sidebar navigation.
     * @example
     * collections: {
     *   docs: { path: '/docs' },
     *   examples: { path: '/examples', layout: 'examples' }
     * }
     */
    collections?: Record<string, CollectionConfig>;

    /**
     * Navigation configuration for auto-generated sidebars
     */
    navigation?: NavigationConfig;

    /**
     * Table of Contents (TOC) configuration
     */
    toc?: TOCConfig;
}

// ============================================================================
// TOC Types
// ============================================================================

/**
 * Table of Contents configuration
 */
export interface TOCConfig {
    /**
     * Minimum heading level to include (1-6)
     * @default 2
     */
    minLevel?: number;

    /**
     * Maximum heading level to include (1-6)
     * @default 3
     */
    maxLevel?: number;
}

/**
 * Heading extracted from page content
 */
export interface TocHeading {
    /** Heading ID (used for anchor links) */
    id: string;
    /** Heading text content */
    text: string;
    /** Heading level (1-6) */
    level: number;
}

// ============================================================================
// Collection Types
// ============================================================================

/**
 * Collection configuration for multi-collection support
 * Each collection generates its own sidebar navigation
 */
export interface CollectionConfig {
    /**
     * URL path prefix for this collection (e.g., '/docs', '/examples')
     * Pages under this path will be included in this collection's navigation.
     */
    path: string;

    /**
     * Default layout to use for pages in this collection
     */
    layout?: string;

    /**
     * Whether to show draft pages in the sidebar
     * - 'dev': Show drafts only in development mode
     * - 'never': Never show drafts in sidebar
     * @default 'dev'
     */
    showDrafts?: 'dev' | 'never';
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation configuration options
 */
export interface NavigationConfig {
    /**
     * Explicit sidebar navigation structure.
     * If provided and autoGenerate is false, this will be used instead of auto-generation.
     */
    sidebar?: NavSection[];

    /**
     * Whether to auto-generate sidebar navigation from pages
     * @default true
     */
    autoGenerate?: boolean;

    /**
     * Whether to show draft pages in the sidebar
     * - 'dev': Show drafts only in development mode
     * - 'never': Never show drafts in sidebar
     * @default 'dev'
     */
    showDrafts?: 'dev' | 'never';
}

/**
 * Navigation section (category group)
 */
export interface NavSection {
    /**
     * Section title displayed in the sidebar
     */
    title: string;

    /**
     * Items in this section
     */
    items: NavItem[];

    /**
     * Sort order for this section (lower numbers come first)
     * @default 0
     */
    order?: number;
}

/**
 * Navigation item (page link or nested group)
 */
export interface NavItem {
    /**
     * Display title for the navigation item
     */
    title: string;

    /**
     * URL path for the link (optional if this is a group)
     */
    href?: string;

    /**
     * Nested items for sub-navigation
     */
    items?: NavItem[];

    /**
     * Sort order within parent (lower numbers come first)
     * @default 0
     */
    order?: number;
}

/**
 * Site-wide configuration
 */
export interface SiteConfig {
    /** Site title */
    title?: string;
    /** Site description for meta tags */
    description?: string;
    /** Site author */
    author?: string;
    /** Base URL of the site (used for canonical URLs and OG tags) */
    url?: string;
    /** Site language code */
    lang?: string;
    /** Path to favicon */
    favicon?: string;
    /** Open Graph image URL for social sharing */
    ogImage?: string;
    /** Twitter/X handle (without @) */
    twitter?: string;
    /** Google Fonts to preload (e.g., ['Inter:wght@400;500;600;700', 'JetBrains+Mono:wght@400;500']) */
    fonts?: string[];
    /** Theme color for mobile browsers */
    themeColor?: string;
}

/**
 * Markdown processing configuration
 */
export interface MarkdownConfig {
    /**
     * Enable syntax highlighting with Shiki
     * @default true
     */
    shiki?: boolean | ShikiConfig;

    /**
     * Custom remark plugins
     */
    remarkPlugins?: unknown[];

    /**
     * Custom rehype plugins
     */
    rehypePlugins?: unknown[];
}

/**
 * Shiki syntax highlighting configuration
 */
export interface ShikiConfig {
    /**
     * Theme for light mode
     * @default 'github-light'
     */
    light?: string;

    /**
     * Theme for dark mode
     * @default 'github-dark'
     */
    dark?: string;

    /**
     * Additional languages to load
     */
    langs?: string[];
}

// ============================================================================
// Route Types
// ============================================================================

/**
 * Route record for SSG
 */
export interface SSGRoute {
    /**
     * URL path pattern (e.g., '/blog/:slug')
     */
    path: string;

    /**
     * Absolute file path to the page component
     */
    file: string;

    /**
     * Route name derived from file path
     */
    name: string;

    /**
     * Layout to use for this route
     */
    layout?: string;

    /**
     * Page component factory
     */
    component?: ComponentFactory<any, any, any>;

    /**
     * Frontmatter metadata from the page
     */
    meta?: PageMeta;

    /**
     * Child routes for nested layouts
     */
    children?: SSGRoute[];
}

/**
 * Resolved static path for dynamic routes
 */
export interface StaticPath {
    /**
     * Route parameters
     */
    params: Record<string, string>;

    /**
     * Optional props to pass to the page
     */
    props?: Record<string, unknown>;
}

/**
 * Function to generate static paths for dynamic routes
 */
export type GetStaticPaths = () => StaticPath[] | Promise<StaticPath[]>;

// ============================================================================
// Page Types
// ============================================================================

/**
 * Page frontmatter metadata
 */
export interface PageMeta {
    /**
     * Page title
     */
    title?: string;

    /**
     * Page description
     */
    description?: string;

    /**
     * Layout to use
     */
    layout?: string;

    /**
     * Draft pages are excluded from production builds
     */
    draft?: boolean;

    /**
     * Custom date for sorting
     */
    date?: string | Date;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Exclude from SSG (render as SPA page)
     */
    ssr?: boolean;

    // ========================================================================
    // Navigation Fields
    // ========================================================================

    /**
     * Category for sidebar navigation grouping.
     * Can be a string for single-level grouping or an array for nested categories.
     * @example 'Getting Started'
     * @example ['Core', 'Signals']
     */
    category?: string | string[];

    /**
     * Sort order within the category (lower numbers come first)
     * @default 0
     */
    order?: number;

    /**
     * Whether to include this page in the sidebar navigation
     * @default true
     */
    sidebar?: boolean;

    /**
     * Disable table of contents for this page
     * @default false
     */
    toc?: boolean | { minLevel?: number; maxLevel?: number };

    /**
     * Extracted headings for table of contents (auto-generated at build time)
     */
    headings?: TocHeading[];

    /**
     * Additional custom metadata
     */
    [key: string]: unknown;
}

/**
 * Page module exports
 */
export interface PageModule {
    /**
     * Default export is the page component
     */
    default: ComponentFactory<any, any, any>;

    /**
     * Optional static paths for dynamic routes
     */
    getStaticPaths?: GetStaticPaths;

    /**
     * Optional layout override
     */
    layout?: string;

    /**
     * Frontmatter from MDX files
     */
    frontmatter?: PageMeta;
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Layout module exports
 */
export interface LayoutModule {
    /**
     * Default export is the layout component
     */
    default: ComponentFactory<LayoutProps, unknown, LayoutSlots>;
}

/**
 * Props passed to layout components
 */
export interface LayoutProps {
    /**
     * Current page metadata
     */
    meta?: PageMeta;

    /**
     * Current route path
     */
    path?: string;
}

/**
 * Slots available in layouts
 */
export interface LayoutSlots {
    /**
     * Default slot contains the page content
     */
    default: () => unknown;
}

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Theme package exports
 */
export interface ThemeModule {
    /**
     * Theme layouts (key is layout name)
     */
    layouts?: Record<string, ComponentFactory<LayoutProps, unknown, LayoutSlots>>;

    /**
     * Theme components available globally
     */
    components?: Record<string, ComponentFactory<any, any, any>>;

    /**
     * Theme configuration
     */
    config?: ThemeConfig;
}

/**
 * Theme configuration options
 */
export interface ThemeConfig {
    /**
     * Default layout from this theme
     */
    defaultLayout?: string;

    /**
     * CSS files to include
     */
    css?: string[];
}

// ============================================================================
// Build Types
// ============================================================================

/**
 * Build options passed to ssg build command
 */
export interface BuildOptions {
    /**
     * Path to ssg.config.ts
     */
    configPath?: string;

    /**
     * Enable verbose logging
     */
    verbose?: boolean;

    /**
     * Number of pages to render in parallel
     * @default 10
     */
    concurrency?: number;
}

/**
 * Build result for a single page
 */
export interface PageBuildResult {
    /**
     * URL path
     */
    path: string;

    /**
     * Output file path
     */
    file: string;

    /**
     * Generation time in ms
     */
    time: number;

    /**
     * HTML size in bytes
     */
    size: number;
}

/**
 * Complete build result
 */
export interface BuildResult {
    /**
     * All generated pages
     */
    pages: PageBuildResult[];

    /**
     * Total build time in ms
     */
    totalTime: number;

    /**
     * Any warnings during build
     */
    warnings: string[];
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * SSG context available in pages
 */
export interface SSGContext {
    /**
     * Site configuration
     */
    site: SiteConfig;

    /**
     * Current page metadata
     */
    page: PageMeta;

    /**
     * Current route parameters
     */
    params: Record<string, string>;

    /**
     * Check if running in dev mode
     */
    isDev: boolean;

    /**
     * Base URL
     */
    base: string;
}

// Virtual module types are declared in virtual.d.ts
