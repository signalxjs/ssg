/**
 * @sigx/ssg - Static Site Generator for SignalX
 *
 * Main entry point - exports all public APIs
 */

// Core types
export type {
    SSGConfig,
    SSGRoute,
    SSGContext,
    SiteConfig,
    HeadTag,
    PageMeta,
    PageModule,
    LayoutModule,
    LayoutProps,
    LayoutSlots,
    StaticPath,
    GetStaticPaths,
    ThemeModule,
    ThemeConfig,
    MarkdownConfig,
    ShikiConfig,
    BuildOptions,
    BuildResult,
    PageBuildResult,
    // Collection types
    CollectionConfig,
    // Navigation types
    NavigationConfig,
    NavSection,
    NavItem,
    // TOC types
    TOCConfig,
    TocHeading,
} from './types';

// Config helper
export { defineSSGConfig, defineSSGConfig as defineConfig } from './config';

// Sitemap utilities
export {
    generateSitemap,
    generateRobotsTxt,
    writeSitemap,
    pagesToSitemapEntries,
} from './sitemap';
export type { SitemapEntry, SitemapOptions } from './sitemap';

// Theme module loading + config contributions (#60)
export { loadThemeModule, applyThemeConfig, resolveThemeConfig } from './theme';

// Redirect emission (#61)
export { generateRedirectHtml, generateRedirectsFile, writeRedirects } from './redirects';
export { extractSearchText, buildSearchIndex, writeSearchIndex } from './search';
export type { SearchOptions, SearchIndexEntry } from './types';
export { runDataLoaders, generateDataModule } from './data';
export { checkLinks, extractLocalLinks, extractElementIds, formatLinkCheckReport } from './link-check';
export { generateDefault404 } from './default-404';
export { gitLastModifiedMap, resolveLastmods } from './lastmod';
export type { BrokenLink, LinkCheckOptions } from './link-check';

// Public-URL path normalization (shared by canonical/og:url/sitemap)
export { normalizePagePath } from './url';
export type { TrailingSlash } from './url';

// Re-export build for programmatic use
export { build } from './build';

// Re-export dev server for programmatic use
export { dev, preview } from './dev';
export type { DevOptions } from './dev';

// Error handling utilities
export { SSGError, ErrorCodes, handleError } from './errors';
