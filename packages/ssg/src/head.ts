/**
 * Head-tag generation
 *
 * Single source for everything per-page-overridable in the document `<head>`:
 * title, description, canonical, Open Graph, Twitter Card, plus the per-page /
 * site-wide injection API (JSON-LD, robots, keywords, arbitrary tags).
 *
 * The HTML templates (dev + prod) deliberately do NOT emit these — emitting them
 * in both places caused duplicate `<title>` tags in built output. Tags are
 * injected at the `<!--head-tags-->` marker during the build.
 */

import type { SSGConfig, PageMeta, HeadTag, AutoJsonLdOptions } from './types';
import { normalizePagePath } from './url';

/**
 * Minimal shape needed to render a page's head. Structurally compatible with
 * the build's internal `PathToRender`.
 */
export interface HeadPathInfo {
    path: string;
    route: { meta?: PageMeta };
}

/**
 * Generate the per-page `<head>` tags to inject at `<!--head-tags-->`.
 *
 * Auto tags (title, description, canonical, OG, Twitter) come first, followed
 * by site-wide then per-page custom tags and JSON-LD. Per-page `meta` overrides
 * site-wide config; `meta.canonical` / `meta.robots` override the defaults.
 */
export function generateHeadTags(pathInfo: HeadPathInfo, config: SSGConfig): string {
    const tags: string[] = [];
    const site = config.site || {};
    const meta = pathInfo.route.meta || {};

    // Identity keys of auto-emitted tags, so custom tags don't double-emit them.
    const emitted = new Set<string>();
    const push = (tag: string, key?: string) => {
        tags.push(tag);
        if (key) emitted.add(key);
    };

    const title = meta.title || site.title;
    const description = meta.description || site.description;
    // Per-page OG overrides (#206); twitter:image/card inherit the resolved image.
    const ogImage = (typeof meta.ogImage === 'string' && meta.ogImage) || site.ogImage;
    const ogImageAlt = (typeof meta.ogImageAlt === 'string' && meta.ogImageAlt) || site.ogImageAlt;
    const ogType = (typeof meta.ogType === 'string' && meta.ogType) || 'website';
    const twitter = site.twitter;

    // Build canonical first so OG/Twitter can reuse it. Mirror sitemap.ts so
    // canonical and sitemap URLs are byte-identical (Google flags soft-conflicts
    // when they differ) — both normalize the path via normalizePagePath. A
    // per-page `meta.canonical` overrides the derived value verbatim.
    let canonical: string | null = null;
    if (typeof meta.canonical === 'string' && meta.canonical) {
        canonical = meta.canonical;
    } else if (site.url) {
        const siteUrl = site.url.replace(/\/$/, '');
        const base = config.base?.replace(/\/$/, '') || '';
        canonical = `${siteUrl}${base}${normalizePagePath(pathInfo.path, config.trailingSlash)}`;
    }

    if (title) {
        push(`<title>${escapeHtml(title)}</title>`, 'title');
    }
    if (description) {
        push(`<meta name="description" content="${escapeHtml(description)}">`, 'meta:name:description');
    }
    if (canonical) {
        push(`<link rel="canonical" href="${escapeHtml(canonical)}">`, 'link:rel:canonical');
    }

    // robots: only emitted when explicitly set (default crawl behaviour is index,follow).
    if (typeof meta.robots === 'string' && meta.robots) {
        push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`, 'meta:name:robots');
    }

    // keywords: per-page only.
    if (meta.keywords != null) {
        const keywords = Array.isArray(meta.keywords) ? meta.keywords.join(', ') : meta.keywords;
        if (keywords) {
            push(`<meta name="keywords" content="${escapeHtml(keywords)}">`, 'meta:name:keywords');
        }
    }

    if (canonical || ogImage) {
        push(`<meta property="og:type" content="${escapeHtml(ogType)}">`, 'meta:property:og:type');
        if (site.title) {
            // Deliberately the site title even when meta.title overrides the
            // page title — og:site_name names the site, not the page.
            push(`<meta property="og:site_name" content="${escapeHtml(site.title)}">`, 'meta:property:og:site_name');
        }
        if (site.lang) {
            // og:locale wants underscore form (en_US); bare "en" is valid as-is.
            push(`<meta property="og:locale" content="${escapeHtml(site.lang.replace(/-/g, '_'))}">`, 'meta:property:og:locale');
        }
        if (title) {
            push(`<meta property="og:title" content="${escapeHtml(title)}">`, 'meta:property:og:title');
        }
        if (description) {
            push(`<meta property="og:description" content="${escapeHtml(description)}">`, 'meta:property:og:description');
        }
        if (canonical) {
            push(`<meta property="og:url" content="${escapeHtml(canonical)}">`, 'meta:property:og:url');
        }
        if (ogImage) {
            push(`<meta property="og:image" content="${escapeHtml(ogImage)}">`, 'meta:property:og:image');
            if (ogImageAlt) {
                push(`<meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}">`, 'meta:property:og:image:alt');
            }
        }
    }

    if (twitter || ogImage) {
        push(
            `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
            'meta:name:twitter:card'
        );
        if (twitter) {
            push(`<meta name="twitter:site" content="@${escapeHtml(twitter)}">`, 'meta:name:twitter:site');
        }
        if (title) {
            push(`<meta name="twitter:title" content="${escapeHtml(title)}">`, 'meta:name:twitter:title');
        }
        if (description) {
            push(`<meta name="twitter:description" content="${escapeHtml(description)}">`, 'meta:name:twitter:description');
        }
        if (ogImage) {
            push(`<meta name="twitter:image" content="${escapeHtml(ogImage)}">`, 'meta:name:twitter:image');
        }
    }

    // Custom <head> tags: site-wide first, then per-page. Skipped only if they
    // would duplicate an auto-emitted tag (e.g. an overridden canonical). We do
    // NOT add custom keys to `emitted`, so custom tags are never deduped against
    // each other (multiple `rel="preload"`/`rel="icon"` links are all kept).
    for (const tag of [...(site.head || []), ...(meta.head || [])]) {
        const key = headTagKey(tag);
        if (key && emitted.has(key)) continue;
        tags.push(renderHeadTag(tag));
    }

    // JSON-LD structured data: auto-generated first (#206), then site-wide,
    // then per-page (most specific last). An auto object is skipped when a
    // hand-written entry of the same @type exists, so a page can hand-craft
    // its breadcrumbs without double emission.
    const handWritten = [...normalizeJsonLd(site.jsonLd), ...normalizeJsonLd(meta.jsonLd)];
    const handTypes = new Set(
        handWritten
            .map((item) => (item as Record<string, unknown>)['@type'])
            .filter((t): t is string => typeof t === 'string')
    );
    const auto = generateAutoJsonLd(pathInfo, config, canonical).filter(
        (item) => !handTypes.has((item as Record<string, unknown>)['@type'] as string)
    );
    for (const item of [...auto, ...handWritten]) {
        tags.push(renderJsonLd(item));
    }

    return tags.join('\n    ');
}

/**
 * Auto-generated JSON-LD for a page (#206): a BreadcrumbList derived from the
 * URL path segments and a TechArticle/Article/WebPage from the page's meta.
 * Opt-in via `config.autoJsonLd`; per-page opt-out via `meta.autoJsonLd: false`.
 */
export function generateAutoJsonLd(
    pathInfo: HeadPathInfo,
    config: SSGConfig,
    canonical: string | null
): object[] {
    const meta = pathInfo.route.meta || {};
    if (!config.autoJsonLd || meta.autoJsonLd === false) return [];
    const opts: AutoJsonLdOptions = config.autoJsonLd === true ? {} : config.autoJsonLd;
    const site = config.site || {};
    const out: object[] = [];

    // BreadcrumbList — needs site.url for absolute item URLs; a single-crumb
    // list on the root page is noise, so / is skipped.
    if (opts.breadcrumbs !== false && site.url && pathInfo.path !== '/') {
        const siteUrl = site.url.replace(/\/$/, '');
        const base = config.base?.replace(/\/$/, '') || '';
        const toUrl = (p: string) => `${siteUrl}${base}${normalizePagePath(p, config.trailingSlash)}`;

        const segments = pathInfo.path.split('/').filter(Boolean);
        const items = [{ name: site.title || 'Home', path: '/' }];
        let cumulative = '';
        for (const segment of segments) {
            cumulative += `/${segment}`;
            items.push({ name: humanizeSegment(segment), path: cumulative });
        }
        // The page itself is best named by its title, not its URL slug.
        if (meta.title) items[items.length - 1].name = meta.title;

        out.push({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: items.map((item, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: item.name,
                item: toUrl(item.path),
            })),
        });
    }

    // Article object — only fields that exist are included.
    if (opts.article !== false) {
        const type = opts.article === true || opts.article === undefined ? 'TechArticle' : opts.article;
        const headline = meta.title || site.title;
        const description = meta.description || site.description;
        if (headline || description) {
            const article: Record<string, unknown> = {
                '@context': 'https://schema.org',
                '@type': type,
            };
            if (headline) article.headline = headline;
            if (description) article.description = description;
            if (canonical) article.url = canonical;
            const published = toIsoDate(meta.date);
            const modified = toIsoDate(meta.lastmod) || published;
            if (published) article.datePublished = published;
            if (modified) article.dateModified = modified;
            out.push(article);
        }
    }

    return out;
}

/** 'getting-started' → 'Getting Started' */
function humanizeSegment(segment: string): string {
    return decodeURIComponent(segment)
        .split(/[-_]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/** Normalize a meta date (Date or string) to an ISO string, or null. */
function toIsoDate(value: unknown): string | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === 'string' && value) return value;
    return null;
}

/** Tags that never have children / closing tags. */
const VOID_TAGS = new Set(['meta', 'link', 'base', 'br', 'hr', 'img', 'input', 'source']);

/**
 * Render a {@link HeadTag} to HTML. Attribute values are escaped; `children`
 * is emitted verbatim (so inline `<script>`/`<style>` content is preserved).
 */
function renderHeadTag(tag: HeadTag): string {
    // Normalize the tag name once so void-tag detection and rendering agree
    // regardless of the caller's casing (e.g. 'META' must not emit '</META>').
    const name = tag.tag.toLowerCase();
    const attrs = tag.attrs
        ? Object.entries(tag.attrs)
              .map(([k, v]) => ` ${k}="${escapeHtml(String(v))}"`)
              .join('')
        : '';
    if (VOID_TAGS.has(name) || tag.children == null) {
        return `<${name}${attrs}>`;
    }
    return `<${name}${attrs}>${tag.children}</${name}>`;
}

/**
 * Identity key for dedup against auto-emitted tags. Returns null for tags we
 * never auto-emit (so custom tags like `<script>` always pass through).
 */
function headTagKey(tag: HeadTag): string | null {
    const name = tag.tag.toLowerCase();
    const attrs = tag.attrs || {};
    // Attribute values are lowercased so e.g. rel="Canonical" / name="Description"
    // dedupe against the (lowercase) auto-emitted keys case-insensitively.
    if (name === 'title') return 'title';
    if (name === 'meta') {
        if (attrs.name) return `meta:name:${attrs.name.toLowerCase()}`;
        if (attrs.property) return `meta:property:${attrs.property.toLowerCase()}`;
    }
    if (name === 'link' && attrs.rel) return `link:rel:${attrs.rel.toLowerCase()}`;
    return null;
}

/** Normalize `object | object[] | undefined` JSON-LD config to an array. */
function normalizeJsonLd(value: object | object[] | undefined): object[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Render a JSON-LD object as a `<script type="application/ld+json">`. Each `<`
 * in the serialized JSON is replaced with its JSON unicode escape (a backslash
 * followed by u003c), so the data cannot break out via a literal `</script>`.
 */
function renderJsonLd(data: object): string {
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
}

/**
 * Script tag embedding a page's getStaticPaths props so the client entry can
 * register them before hydration (#73). Empty when the page has no props.
 * `<` is JSON-unicode-escaped so the payload cannot break out via a literal
 * `</script>` (same hardening as renderJsonLd above).
 */
export function pagePropsScript(path: string, props: Record<string, unknown> | undefined): string {
    if (!props || Object.keys(props).length === 0) return '';
    const json = JSON.stringify({ path, props }).replace(/</g, '\\u003c');
    return `<script>window.__SSG_PROPS__=${json}</script>`;
}

/**
 * Escape HTML special characters in attribute values / text.
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
