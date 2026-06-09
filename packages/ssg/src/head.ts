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

import type { SSGConfig, PageMeta, HeadTag } from './types';

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
    const ogImage = site.ogImage;
    const twitter = site.twitter;

    // Build canonical first so OG/Twitter can reuse it. Mirror sitemap.ts so
    // canonical and sitemap URLs are byte-identical (Google flags soft-conflicts
    // when they differ). A per-page `meta.canonical` overrides the derived value.
    let canonical: string | null = null;
    if (typeof meta.canonical === 'string' && meta.canonical) {
        canonical = meta.canonical;
    } else if (site.url) {
        const siteUrl = site.url.replace(/\/$/, '');
        const base = config.base?.replace(/\/$/, '') || '';
        canonical = `${siteUrl}${base}${pathInfo.path}`;
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
        push(`<meta property="og:type" content="website">`, 'meta:property:og:type');
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

    // Custom <head> tags: site-wide first, then per-page. Skipped if they would
    // duplicate an already-emitted auto tag (e.g. an overridden canonical).
    for (const tag of [...(site.head || []), ...(meta.head || [])]) {
        const key = headTagKey(tag);
        if (key && emitted.has(key)) continue;
        if (key) emitted.add(key);
        tags.push(renderHeadTag(tag));
    }

    // JSON-LD structured data: site-wide first, then per-page.
    for (const item of [...normalizeJsonLd(site.jsonLd), ...normalizeJsonLd(meta.jsonLd)]) {
        tags.push(renderJsonLd(item));
    }

    return tags.join('\n    ');
}

/** Tags that never have children / closing tags. */
const VOID_TAGS = new Set(['meta', 'link', 'base', 'br', 'hr', 'img', 'input', 'source']);

/**
 * Render a {@link HeadTag} to HTML. Attribute values are escaped; `children`
 * is emitted verbatim (so inline `<script>`/`<style>` content is preserved).
 */
function renderHeadTag(tag: HeadTag): string {
    const attrs = tag.attrs
        ? Object.entries(tag.attrs)
              .map(([k, v]) => ` ${k}="${escapeHtml(String(v))}"`)
              .join('')
        : '';
    if (VOID_TAGS.has(tag.tag) || tag.children == null) {
        return `<${tag.tag}${attrs}>`;
    }
    return `<${tag.tag}${attrs}>${tag.children}</${tag.tag}>`;
}

/**
 * Identity key for dedup against auto-emitted tags. Returns null for tags we
 * never auto-emit (so custom tags like `<script>` always pass through).
 */
function headTagKey(tag: HeadTag): string | null {
    const name = tag.tag.toLowerCase();
    const attrs = tag.attrs || {};
    if (name === 'title') return 'title';
    if (name === 'meta') {
        if (attrs.name) return `meta:name:${attrs.name}`;
        if (attrs.property) return `meta:property:${attrs.property}`;
    }
    if (name === 'link' && attrs.rel) return `link:rel:${attrs.rel}`;
    return null;
}

/** Normalize `object | object[] | undefined` JSON-LD config to an array. */
function normalizeJsonLd(value: object | object[] | undefined): object[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Render a JSON-LD object as a `<script type="application/ld+json">`. Escapes
 * `<` to `<` to prevent a `</script>` breakout from the serialized data.
 */
function renderJsonLd(data: object): string {
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
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
