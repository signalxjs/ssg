/**
 * Pure helpers for the per-page chrome (signalxjs/ssg#65): edit-this-page
 * links, breadcrumbs, last-updated, and announcement dismissal keys.
 */

import type { PageMeta, SiteConfig } from '@sigx/ssg';

/** Edit URL for a page: `site.editBase` + `meta.sourceFile`, or null. */
export function editUrl(site?: SiteConfig, meta?: PageMeta): string | null {
    if (!site?.editBase || !meta?.sourceFile) return null;
    return site.editBase.replace(/\/+$/, '') + '/' + meta.sourceFile.replace(/^\/+/, '');
}

export interface Crumb {
    title: string;
    href?: string;
}

interface CrumbNavItem {
    title: string;
    href?: string;
    items?: CrumbNavItem[];
}

interface CrumbNavSection {
    title: string;
    items: CrumbNavItem[];
}

function samePath(a: string, b: string): boolean {
    return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
}

/**
 * Breadcrumb trail for the current page from the collection sidebar:
 * section title, then the nested item chain down to the page.
 */
export function breadcrumbs(sections: CrumbNavSection[], currentPath: string): Crumb[] {
    for (const section of sections) {
        const chain = findChain(section.items, currentPath);
        if (chain) {
            return [{ title: section.title }, ...chain.map((i) => ({ title: i.title, href: i.href }))];
        }
    }
    return [];
}

function findChain(items: CrumbNavItem[], currentPath: string): CrumbNavItem[] | null {
    for (const item of items) {
        if (item.href && samePath(item.href, currentPath)) return [item];
        if (item.items?.length) {
            const sub = findChain(item.items, currentPath);
            if (sub) return [item, ...sub];
        }
    }
    return null;
}

/**
 * Display date for "last updated": frontmatter `updated` wins over `date`;
 * null when neither parses. (Git-based timestamps are #38's territory.)
 */
export function lastUpdated(meta?: PageMeta): Date | null {
    const raw = (meta as Record<string, unknown> | undefined)?.updated ?? meta?.date;
    if (!raw) return null;
    const date = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isNaN(date.getTime()) ? null : date;
}

/** localStorage key for an announcement's dismissal, stable per `id`. */
export function announcementKey(announcement: { id?: string; text: string }): string {
    return `sigx-announcement-${announcement.id ?? announcement.text.slice(0, 32)}`;
}
