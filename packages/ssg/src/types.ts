/**
 * @sigx/ssg - Static Site Generator for SignalX
 *
 * Core types and interfaces for the SSG system
 */

import type { ComponentFactory } from 'sigx';
import type { ShikiTransformer } from 'shiki';
import type { TrailingSlash } from './url';

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
     * Trailing-slash policy for derived public URLs (canonical, og:url,
     * sitemap `<loc>`). `'always'` matches the `<path>/index.html` output
     * layout, where static hosts serve `/about/` with 200 and 301 `/about`.
     * Use `'never'` only when the host serves the slash-less URL directly.
     * @default 'always'
     */
    trailingSlash?: TrailingSlash;

    /**
     * Site-wide metadata
     */
    site?: SiteConfig;

    /**
     * Markdown/MDX configuration
     */
    markdown?: MarkdownConfig;

    // ========================================================================
    // Zero-Config Options
    // ========================================================================

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

    /**
     * Route internal anchor clicks through the router (SPA navigation)
     * instead of full page reloads. Set to `false` for MPA behavior.
     * Per-link opt-out: `data-no-spa`.
     * @default true
     */
    spaNavigation?: boolean;

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

    /**
     * Sitemap generation options, or `false` to disable sitemap.xml and
     * robots.txt generation entirely.
     * @default {}
     */
    sitemap?: SitemapOptions | false;

    /**
     * Build pipeline hooks — the extension points for search indexing,
     * OG-image generation, link checking, HTML post-processing, …
     * A hook that throws fails the build.
     */
    hooks?: BuildHooks;

    /**
     * Static redirects, `{ '/old': '/new/' }`. Each entry emits a
     * meta-refresh page at the old path (canonical → target, noindex)
     * plus a line in a `_redirects` file for hosts that support real 301s.
     * Relative targets are prefixed with `base`; absolute URLs pass through.
     */
    redirects?: Record<string, string>;

    /**
     * Built-in search (#62). `true` emits a `search-index.json` over the
     * rendered pages at build time — one entry per page with title,
     * description, headings, and visible text (`noindex` pages and the 404
     * page are excluded, like the sitemap). Consume it with
     * `loadSearchIndex()`/`searchPages()` from `@sigx/ssg/client`, or the
     * theme command palette.
     * @default false
     */
    search?: boolean | SearchOptions;

    /**
     * Programmatic routes (#59): pages that don't come from the filesystem
     * scan — CMS-backed pages, tag archives, generated docs. Merged with the
     * scanned routes everywhere (dev, build, navigation). Each route points
     * at a component file; a path collision with a scanned page is an error.
     */
    routes?: (ctx: RoutesContext) => ProgrammaticRoute[] | Promise<ProgrammaticRoute[]>;

    /**
     * Build-time data loaders (#59): each runs once per build (shared
     * across the client and SSR builds) and once per dev-server start;
     * results are exposed via `virtual:ssg-data` (typed default export;
     * per-key named exports exist — augment the module for typed named
     * imports). Values must be JSON-serializable — they are baked into the
     * bundle. Replaces fetch-data-before-build scripts.
     */
    data?: DataLoaders;
}

/**
 * Page context passed to per-page build hooks.
 */
export interface BuildHookPage {
    /** URL path being rendered (e.g. `/blog/my-post`). */
    path: string;
    /** Route params for dynamic routes. */
    params: Record<string, string>;
    /** getStaticPaths props, when present. */
    props?: Record<string, unknown>;
    /** The page's route metadata (frontmatter / `export const meta`). */
    meta?: PageMeta;
    /** The matched route definition. */
    route: SSGRoute;
}

/**
 * Build pipeline hooks (production builds only).
 *
 * The per-page hooks (`transformHtml`, `onPageRendered`) run inside the
 * parallel render/write phases — they may be invoked CONCURRENTLY and in no
 * guaranteed order. Avoid unsynchronized shared state beyond append-only
 * collection. `postBuild` runs exactly once, after everything else.
 */
export interface BuildHooks {
    /**
     * Transform a page's final HTML before it is written. Runs per page,
     * after head tags and app HTML are injected.
     */
    transformHtml?: (html: string, page: BuildHookPage) => string | Promise<string>;

    /**
     * Observe each page after it has been rendered and written — the build
     * result entry plus the final HTML (e.g. feed entries, search indexing
     * per page).
     */
    onPageRendered?: (page: PageBuildResult & { html: string }) => void | Promise<void>;

    /**
     * Run once after all pages are written and the sitemap is generated —
     * the slot for search indexes, link checkers, redirects files, …
     */
    postBuild?: (
        result: { pages: PageBuildResult[]; warnings: string[] },
        ctx: { outDir: string; config: SSGConfig }
    ) => void | Promise<void>;
}

/**
 * Sitemap entry with optional metadata
 */
export interface SitemapEntry {
    /** URL path (relative to site base) */
    path: string;
    /** Last modification date */
    lastmod?: Date | string;
    /** Change frequency hint */
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    /** Priority relative to other pages (0.0 to 1.0) */
    priority?: number;
}

/**
 * Sitemap generation options
 */
export interface SitemapOptions {
    /** Include all built pages automatically */
    includePages?: boolean;
    /** Additional URLs to include */
    additionalUrls?: SitemapEntry[];
    /** URLs to exclude (glob patterns or exact matches) */
    exclude?: string[];
    /** Default change frequency */
    defaultChangefreq?: SitemapEntry['changefreq'];
    /** Default priority */
    defaultPriority?: number;
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

    /**
     * Sort order per section/category title, merged over the built-in
     * defaults. Lower numbers come first; unlisted titles default to 50 (#60).
     */
    sectionOrder?: Record<string, number>;
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
/**
 * A raw tag to inject into the document `<head>`.
 *
 * `attrs` values are HTML-escaped; `children` is emitted verbatim (not escaped),
 * so it can hold inline JSON, CSS, or script content.
 */
export interface HeadTag {
    /** Tag name, e.g. 'meta' | 'link' | 'script' | 'style' */
    tag: string;
    /** Attributes (values are HTML-escaped) */
    attrs?: Record<string, string>;
    /** Raw inner content for non-void tags (emitted verbatim) */
    children?: string;
}

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
    /**
     * Global JSON-LD structured data applied to every page.
     * Each object is emitted as a separate `<script type="application/ld+json">`.
     */
    jsonLd?: object | object[];

    /**
     * Main navigation items, for layouts/themes to render (header nav etc.).
     * Reaches layouts via `LayoutProps.site` (#60).
     */
    nav?: NavItem[];

    /** Logo URL/path, for layouts/themes to render (#60). */
    logo?: string;

    /**
     * Repository URL (e.g. for a header GitHub link or edit-this-page
     * links), for layouts/themes to render (#60).
     */
    repo?: string;

    /** Extra `<head>` tags appended to every page */
    head?: HeadTag[];
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

    /**
     * Label for the live code "Try Live" trigger button rendered on live
     * fences. A per-fence `label="…"` meta overrides this for a single block.
     * Mirrors `@sigx/live-code`'s `configurePlayground({ triggerLabel })`, which
     * covers the runtime LivePreview islands.
     * @default '⚡ Try Live'
     */
    triggerLabel?: string;

    /**
     * Default package manager shown first on shell fences whose lines are
     * `npm`/`pnpm`/`yarn`/`bun` commands (install/add, run, dlx, create, remove,
     * …). Such fences are rendered with an npm/pnpm/yarn/bun tab strip and all
     * four variants pre-rendered server-side; the client switcher
     * (`@sigx/ssg/client`) only flips which variant is visible. A visitor's saved
     * choice overrides this.
     * @default 'pnpm'
     */
    defaultPackageManager?: 'pnpm' | 'npm' | 'yarn' | 'bun';

    /**
     * Shiki transformers applied to every highlighted block (including each
     * package-manager variant). The raw fence meta is exposed as
     * `options.meta.__raw`, so `@shikijs/transformers` meta-driven features
     * (line highlighting `{1,3-5}`, diff, focus, word highlight) work without
     * core changes.
     */
    transformers?: ShikiTransformer[];

    /**
     * Fence languages the highlighter leaves untouched (raw `<pre><code
     * class="language-…">` survives in the output), so a later rehype plugin
     * or island can claim them — e.g. `['mermaid', 'math']`.
     */
    skipLanguages?: string[];
}

/**
 * Built-in search configuration (#62).
 */
export interface SearchOptions {
    /**
     * Index filename inside `outDir`.
     * @default 'search-index.json'
     */
    output?: string;

    /**
     * Cap on indexed visible text per page, in characters.
     * @default 8000
     */
    maxTextLength?: number;
}

/**
 * One page in the emitted search index (#62).
 */
export interface SearchIndexEntry {
    /** URL path of the page (no `base` prefix). */
    path: string;
    /** Page title (frontmatter title, else first heading, else the path). */
    title: string;
    /** Frontmatter description, when set. */
    description?: string;
    /** The page's headings — matches deep-link via `#id`. */
    headings: TocHeading[];
    /** The page's visible text (capped, see `SearchOptions.maxTextLength`). */
    text: string;
    /** Frontmatter tags, when set. */
    tags?: string[];
}

// ============================================================================
// Route Types
// ============================================================================

/**
 * Route record for SSG
 */
/** Context passed to `config.routes` (#59). */
export interface RoutesContext {
    config: SSGConfig;
    root: string;
}

/** A route added by `config.routes` rather than the filesystem scan (#59). */
export interface ProgrammaticRoute {
    /** URL path — concrete (`/tags/sigx`) or with params (`/tags/:tag`). */
    path: string;
    /** Component file, absolute or relative to the project root. */
    file: string;
    /** Layout name, like a scanned page's `layout` frontmatter. */
    layout?: string;
    /** Page metadata (title, description, … — used for head/sitemap). */
    meta?: PageMeta;
}

/** Build-time data loaders for `virtual:ssg-data` (#59). */
export type DataLoaders = Record<string, () => unknown | Promise<unknown>>;

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
     * True when `title` was derived from the content's first H1 rather than
     * frontmatter — layouts rendering their own `<h1>{title}</h1>` should
     * skip it to avoid a double heading (#65).
     */
    titleFromContent?: boolean;

    // ========================================================================
    // SEO Fields
    // ========================================================================

    /**
     * Per-page JSON-LD structured data.
     * Each object is emitted as a separate `<script type="application/ld+json">`.
     */
    jsonLd?: object | object[];

    /**
     * Arbitrary extra `<head>` tags for this page (e.g. `<meta>`, `<link>`).
     */
    head?: HeadTag[];

    /**
     * `robots` directive (e.g. 'noindex, nofollow'). No tag is emitted unless set.
     */
    robots?: string;

    /**
     * Override the auto-derived canonical URL for this page.
     */
    canonical?: string;

    /**
     * Keywords for `<meta name="keywords">` (arrays are joined with ', ').
     */
    keywords?: string | string[];

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

    /**
     * Site-wide config (title, nav, logo, repo, …) so layouts/themes can
     * render branding without hardcoding it (#60).
     */
    site?: SiteConfig;
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
     * Default layout from this theme. Used when the site doesn't set its
     * own `defaultLayout` (#60).
     */
    defaultLayout?: string;

    /**
     * Markdown plugins this theme contributes. They run before the site's
     * own `markdown.remarkPlugins` / `rehypePlugins` (#60).
     */
    markdown?: Pick<MarkdownConfig, 'remarkPlugins' | 'rehypePlugins'>;

    /**
     * Head tags this theme contributes (prepended to `site.head`) (#60).
     */
    head?: HeadTag[];

    /**
     * CSS imports this theme contributes — import specifiers (e.g.
     * '@my/theme/styles.css'), prepended to `clientImports` (#60).
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
     * @default 20
     */
    concurrency?: number;

    /**
     * Include pages with `draft: true` frontmatter in the build.
     * Drafts are excluded from production builds (and the sitemap) by default.
     * @default false
     */
    drafts?: boolean;
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

    /**
     * The page's route metadata (frontmatter / `export const meta`).
     * Carried through the build so consumers (sitemap noindex/lastmod,
     * feeds, …) can act on it.
     */
    meta?: PageMeta;
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
