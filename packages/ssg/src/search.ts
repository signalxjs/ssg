/**
 * Built-in search index (signalxjs/ssg#62).
 *
 * `search: true` in the config emits a `search-index.json` over the rendered
 * pages: one entry per page with title, description, headings, and the
 * page's visible text. The client side (`searchPages`/`loadSearchIndex` in
 * `@sigx/ssg/client`) and the theme command palette consume it.
 *
 * Indexing follows the sitemap's visibility convention: `noindex` pages and
 * the 404 page are excluded (drafts never reach the build in production).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { PageBuildResult, SearchIndexEntry, SearchOptions } from './types';

/** Default cap on indexed text per page — keeps the index lean. */
const DEFAULT_MAX_TEXT = 8000;

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
    return text
        .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/**
 * The page's visible text: the `<main>` element when present (page chrome —
 * nav, header, footer — would pollute every entry with the same words),
 * otherwise the body minus script/style and semantic chrome elements.
 */
export function extractSearchText(html: string): string {
    const main = html.match(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/i)?.[0];
    let scope = main ?? html.match(/<body(?:\s[^>]*)?>[\s\S]*?<\/body>/i)?.[0] ?? html;
    scope = scope.replace(/<(script|style|template|noscript)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '');
    if (!main) {
        scope = scope.replace(/<(nav|header|footer|aside)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '');
    }
    const text = scope.replace(/<[^>]+>/g, ' ');
    return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/**
 * Headings with ids from rendered HTML — the fallback when the page's route
 * meta carries none (at build time the scanner meta has frontmatter only;
 * the MDX-exported headings live in the SSR module). Ids come from the same
 * HTML the user sees, so deep links always match.
 */
function extractHeadingsFromHtml(html: string): Array<{ id: string; text: string; level: number }> {
    const scope = html.match(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/i)?.[0] ?? html;
    const headings: Array<{ id: string; text: string; level: number }> = [];
    const re = /<h([2-4])\s[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    for (const m of scope.matchAll(re)) {
        const inner = m[3].replace(/<a\s[^>]*class="[^"]*heading-anchor[^"]*"[\s\S]*?<\/a>/gi, '');
        const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        if (text) headings.push({ id: m[2], text, level: Number(m[1]) });
    }
    return headings;
}

/** Build index entries from rendered pages (filters noindex + 404). */
export function buildSearchIndex(
    docs: Array<{ page: PageBuildResult; html: string }>,
    options: SearchOptions = {}
): SearchIndexEntry[] {
    const maxText = options.maxTextLength ?? DEFAULT_MAX_TEXT;
    const entries: SearchIndexEntry[] = [];

    for (const { page, html } of docs) {
        const robots = page.meta?.robots;
        if (typeof robots === 'string' && robots.includes('noindex')) continue;
        if (page.path === '/404' || page.path === '/404.html') continue;

        const metaHeadings = page.meta?.headings ?? [];
        const headings = metaHeadings.length
            ? metaHeadings.map((h) => ({ id: h.id, text: h.text, level: h.level }))
            : extractHeadingsFromHtml(html);

        const entry: SearchIndexEntry = {
            path: page.path,
            title: page.meta?.title || headings[0]?.text || page.path,
            headings,
            text: extractSearchText(html).slice(0, maxText),
        };
        if (page.meta?.description) entry.description = page.meta.description;
        if (page.meta?.tags?.length) entry.tags = page.meta.tags;
        entries.push(entry);
    }

    return entries;
}

/** Write the versioned index file into `outDir`. */
export async function writeSearchIndex(
    entries: SearchIndexEntry[],
    outDir: string,
    options: SearchOptions = {}
): Promise<string> {
    const outputPath = path.join(outDir, options.output ?? 'search-index.json');
    await fs.writeFile(outputPath, JSON.stringify({ version: 1, entries }), 'utf-8');
    return outputPath;
}
