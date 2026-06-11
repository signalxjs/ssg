/**
 * Sitemap Generation
 *
 * Generates XML sitemaps for SSG sites following the sitemap protocol.
 * https://www.sitemaps.org/protocol.html
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { SSGConfig, PageBuildResult, SitemapEntry, SitemapOptions } from './types';
import { normalizePagePath } from './url';

// Definitions live in types.ts (referenced by SSGConfig.sitemap); re-exported
// here for backwards compatibility with existing imports.
export type { SitemapEntry, SitemapOptions } from './types';

/**
 * Generate sitemap XML content
 */
export function generateSitemap(
    entries: SitemapEntry[],
    config: SSGConfig
): string {
    const siteUrl = config.site?.url?.replace(/\/$/, '') || '';
    const base = config.base?.replace(/\/$/, '') || '';

    const urlEntries = entries.map((entry) => {
        // Mirrors head.ts canonical derivation — keep byte-identical (#41).
        const loc = `${siteUrl}${base}${normalizePagePath(entry.path, config.trailingSlash)}`;
        const lastmod = entry.lastmod
            ? typeof entry.lastmod === 'string'
                ? entry.lastmod
                : entry.lastmod.toISOString().split('T')[0]
            : undefined;

        return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}${entry.changefreq ? `
    <changefreq>${entry.changefreq}</changefreq>` : ''}${entry.priority !== undefined ? `
    <priority>${entry.priority.toFixed(1)}</priority>` : ''}
  </url>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(config: SSGConfig, sitemapPath = '/sitemap.xml'): string {
    const siteUrl = config.site?.url?.replace(/\/$/, '') || '';
    const base = config.base?.replace(/\/$/, '') || '';

    return `User-agent: *
Allow: /

Sitemap: ${siteUrl}${base}${sitemapPath}
`;
}

/**
 * Convert page build results to sitemap entries
 */
export function pagesToSitemapEntries(
    pages: PageBuildResult[],
    options: SitemapOptions = {}
): SitemapEntry[] {
    const {
        exclude = [],
        defaultChangefreq = 'weekly',
        defaultPriority = 0.5,
    } = options;

    return pages
        .filter((page) => {
            // Pages opting out of indexing must not be advertised (#56),
            // and a 404 page is never a crawlable URL.
            const robots = page.meta?.robots;
            if (typeof robots === 'string' && robots.includes('noindex')) return false;
            if (page.path === '/404' || page.path === '/404.html') return false;

            // Filter out excluded paths
            for (const pattern of exclude) {
                if (pattern.includes('*') || pattern.includes('?')) {
                    // Glob matching: escape regex metacharacters first so e.g.
                    // the `.` in `/docs/v1.0/*` stays literal, then expand the
                    // glob tokens.
                    const regex = new RegExp(
                        '^' +
                            pattern
                                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                                .replace(/\*/g, '.*')
                                .replace(/\?/g, '.') +
                            '$'
                    );
                    if (regex.test(page.path)) return false;
                } else if (page.path === pattern) {
                    return false;
                }
            }
            return true;
        })
        .map((page) => {
            // Determine priority based on path depth
            const depth = page.path.split('/').filter(Boolean).length;
            let priority = defaultPriority;

            if (page.path === '/') {
                priority = 1.0; // Homepage highest priority
            } else if (depth === 1) {
                priority = 0.8; // Top-level pages
            } else if (depth === 2) {
                priority = 0.6; // Second-level pages
            }

            // meta.date is a freshness signal crawlers can use (#56)
            const date = page.meta?.date;
            const lastmod = date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined;

            return {
                path: page.path,
                changefreq: defaultChangefreq,
                priority,
                ...(lastmod ? { lastmod } : {}),
            };
        });
}

/**
 * Write sitemap and robots.txt to output directory
 */
export async function writeSitemap(
    pages: PageBuildResult[],
    config: SSGConfig,
    outDir: string,
    options: SitemapOptions = {}
): Promise<{ sitemapPath: string; robotsPath: string }> {
    // Generate entries from pages (includePages: false → additionalUrls only)
    const entries = options.includePages === false ? [] : pagesToSitemapEntries(pages, options);

    // Add additional URLs if provided
    if (options.additionalUrls) {
        entries.push(...options.additionalUrls);
    }

    // Generate sitemap XML
    const sitemapContent = generateSitemap(entries, config);
    const sitemapPath = path.join(outDir, 'sitemap.xml');
    await fs.writeFile(sitemapPath, sitemapContent, 'utf-8');

    // Generate robots.txt — but never clobber one the user shipped via
    // public/ (Vite copies it into outDir before we run) (#56).
    const robotsPath = path.join(outDir, 'robots.txt');
    if (!fsSync.existsSync(robotsPath)) {
        await fs.writeFile(robotsPath, generateRobotsTxt(config), 'utf-8');
    }

    return { sitemapPath, robotsPath };
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
