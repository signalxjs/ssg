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

// Re-export build for programmatic use
export { build } from './build';

// Re-export dev server for programmatic use
export { dev, preview } from './dev';
export type { DevOptions } from './dev';

// Error handling utilities
export { SSGError, ErrorCodes, handleError } from './errors';
