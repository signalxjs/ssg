/**
 * Sitemap Generation
 *
 * Generates XML sitemaps for SSG sites following the sitemap protocol.
 * https://www.sitemaps.org/protocol.html
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { SSGConfig, PageBuildResult } from './types';

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
        const loc = `${siteUrl}${base}${entry.path}`;
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
            // Filter out excluded paths
            for (const pattern of exclude) {
                if (pattern.includes('*')) {
                    // Simple glob matching
                    const regex = new RegExp(
                        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
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

            return {
                path: page.path,
                changefreq: defaultChangefreq,
                priority,
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
    // Generate entries from pages
    const entries = pagesToSitemapEntries(pages, options);

    // Add additional URLs if provided
    if (options.additionalUrls) {
        entries.push(...options.additionalUrls);
    }

    // Generate sitemap XML
    const sitemapContent = generateSitemap(entries, config);
    const sitemapPath = path.join(outDir, 'sitemap.xml');
    await fs.writeFile(sitemapPath, sitemapContent, 'utf-8');

    // Generate robots.txt
    const robotsContent = generateRobotsTxt(config);
    const robotsPath = path.join(outDir, 'robots.txt');
    await fs.writeFile(robotsPath, robotsContent, 'utf-8');

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
