/**
 * LLM-friendly output (#176) — llms.txt / llms-full.txt / per-page markdown.
 *
 * Emits the llms.txt convention (https://llmstxt.org/) over the built pages:
 * an `llms.txt` index of the pages' markdown renditions, an `llms-full.txt`
 * concatenation of those renditions, one cleaned `.md` file next to each
 * markdown-sourced page's HTML, and optional per-area sub-indexes.
 *
 * One rendition per page, computed once by `prepareLlmsPages` and reused by
 * every output; `buildLlmsIndex`/`buildLlmsFullText` are pure over the
 * prepared pages, so per-area files are just filtered re-invocations.
 * Visibility follows the sitemap: `noindex` pages and the 404 page are
 * excluded (drafts never reach the build in production), plus `exclude`
 * globs and per-page frontmatter `llms: false`.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type {
    SSGConfig,
    SSGRoute,
    PageBuildResult,
    LlmsOptions,
    LlmsSection,
    LlmsFullOptions,
    NavItem,
} from './types';
import { normalizePagePath } from './url';
import { createGlobMatcher } from './glob';
import { renderPageMarkdown } from './llms-md';
import {
    generateNavigation,
    isUnderCollectionPath,
    normalizeSectionOrder,
    detectCollection,
    routeToTitle,
} from './routing/navigation';

// Definitions live in types.ts (referenced by SSGConfig.llms); re-exported
// here to keep the helper family importable from one module.
export type { LlmsOptions, LlmsSection, LlmsLink, LlmsFullOptions, LlmsAreaOptions } from './types';

/** A built page prepared for the llms outputs. */
export interface LlmsPage {
    page: PageBuildResult;
    /** Absolute HTML URL (site.url + base + normalized route path). */
    url: string;
    /**
     * `outDir`-relative path of the page's `.md` rendition (e.g.
     * `docs/guide.md`); unset for pages without a markdown source.
     */
    mdPath?: string;
    /** The rendition (header block included); unset alongside `mdPath`. */
    markdown?: string;
}

/**
 * Map a route path to its `.md` rendition path (relative to `outDir`) —
 * the markdown sibling of `getOutputPath`'s HTML layout: `/docs/guide/` →
 * `docs/guide.md`, the root `/` → `index.md`, `/foo.html` → `foo.md`.
 */
export function getMarkdownPath(urlPath: string): string {
    const normalized = urlPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!normalized) return 'index.md';
    if (normalized.endsWith('.html')) return `${normalized.slice(0, -'.html'.length)}.md`;
    return `${normalized}.md`;
}

/** Absolute page URL — byte-identical with the canonical/sitemap derivation (#41). */
function pageUrl(config: SSGConfig, routePath: string): string {
    const siteUrl = config.site?.url?.replace(/\/$/, '') || '';
    const base = config.base?.replace(/\/$/, '') || '';
    return `${siteUrl}${base}${normalizePagePath(routePath, config.trailingSlash)}`;
}

/**
 * Filter the built pages down to the llms-visible set and render each
 * markdown-sourced page's rendition. `readSource` is injectable so unit
 * tests need no filesystem; it defaults to reading `page.source`.
 */
export async function prepareLlmsPages(
    pages: PageBuildResult[],
    config: SSGConfig,
    options: LlmsOptions = {},
    readSource: (file: string) => Promise<string | null> = (file) =>
        fs.readFile(file, 'utf-8').catch(() => null)
): Promise<LlmsPage[]> {
    const excluded = createGlobMatcher(options.exclude ?? []);
    const result: LlmsPage[] = [];

    for (const page of pages) {
        // Same visibility rules as the sitemap/search (#56).
        const robots = page.meta?.robots;
        if (typeof robots === 'string' && robots.includes('noindex')) continue;
        if (page.path === '/404' || page.path === '/404.html') continue;
        if (excluded(page.path)) continue;
        if (page.meta?.llms === false) continue;

        const url = pageUrl(config, page.path);
        const llmsPage: LlmsPage = { page, url };

        // Only `.md`/`.mdx` sources have a markdown rendition; a dynamic
        // route's source is shared by all its expansions, so per-path
        // renditions would be N identical copies — skip those too.
        const source = page.source ?? '';
        const isMarkdown = /\.mdx?$/i.test(source);
        const isDynamic = /\[.*\]/.test(path.basename(source));
        if (isMarkdown && !isDynamic) {
            const raw = await readSource(source);
            if (raw != null) {
                let md = renderPageMarkdown(raw, {
                    url,
                    meta: page.meta,
                    sourceFile: source,
                });
                if (options.transform) {
                    const transformed = options.transform(md, page);
                    // Dropped renditions drop the page from every output —
                    // an index link to a never-written .md is a broken link.
                    if (transformed == null) continue;
                    md = transformed;
                }
                llmsPage.markdown = md;
                llmsPage.mdPath = getMarkdownPath(page.path);
            }
        }

        result.push(llmsPage);
    }

    return result;
}

/** One resolved index entry. */
interface LlmsEntry {
    title: string;
    href: string;
    note?: string;
}

function entryLine(entry: LlmsEntry): string {
    return `- [${entry.title}](${entry.href})${entry.note ? `: ${entry.note}` : ''}`;
}

/** Trailing-slash-insensitive route key. */
function routeKey(routePath: string): string {
    const stripped = routePath.replace(/\/+$/, '');
    return stripped === '' ? '/' : stripped;
}

const EXTERNAL_HREF = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Generate the llms.txt index over prepared pages. Pure — the per-area
 * files call this with a filtered `LlmsPage[]` and merged options.
 */
export function buildLlmsIndex(
    pages: LlmsPage[],
    config: SSGConfig,
    options: LlmsOptions = {}
): string {
    const base = config.base?.replace(/\/$/, '') || '';
    const useMd = options.pageMd !== false;
    const byPath = new Map(pages.map((lp) => [routeKey(lp.page.path), lp]));

    // Index links are root-relative (llms.txt lives next to the content),
    // pointing at the .md renditions; pages without one (or with pageMd
    // off) fall back to their HTML route.
    const hrefFor = (lp: LlmsPage): string =>
        useMd && lp.mdPath
            ? `${base}/${lp.mdPath}`
            : `${base}${normalizePagePath(lp.page.path, config.trailingSlash)}`;
    const entryFor = (lp: LlmsPage, note?: string): LlmsEntry => ({
        title: lp.page.meta?.title || routeToTitle(lp.page.path),
        href: hrefFor(lp),
        note: note ?? lp.page.meta?.description,
    });

    const sections = options.sections
        ? resolveCuratedSections(options.sections, pages, byPath, config, entryFor)
        : autoSections(pages, config, entryFor);

    const title = options.title ?? config.site?.title ?? 'Site';
    const description = options.description ?? config.site?.description;

    const blocks: string[] = [`# ${title}`];
    if (description) blocks.push(`> ${description}`);
    if (options.intro) blocks.push(options.intro.trim());

    for (const section of sections) {
        if (section.entries.length === 0) continue;
        blocks.push(`## ${section.title}\n\n${section.entries.map(entryLine).join('\n')}`);
    }

    // Hub block linking the per-area sub-indexes (Svelte style).
    const areas = Object.entries(options.areas ?? {});
    if (areas.length > 0) {
        const lines = areas.map(([prefix, areaOptions]) =>
            entryLine({
                title: areaOptions.title ?? areaTitle(prefix, config),
                href: `${base}${routeKey(prefix)}/llms.txt`,
                note: areaOptions.description,
            })
        );
        blocks.push(`## Docs sets\n\n${lines.join('\n')}`);
    }

    return `${blocks.join('\n\n')}\n`;
}

interface ResolvedSection {
    title: string;
    entries: LlmsEntry[];
}

/** Prettified name of the collection matching an area prefix, else of the prefix. */
function areaTitle(prefix: string, config: SSGConfig): string {
    for (const [name, collection] of Object.entries(config.collections ?? {})) {
        if (routeKey(collection.path) === routeKey(prefix)) return routeToTitle(name);
    }
    return routeToTitle(prefix);
}

/**
 * Ordered .md-bearing pages of one collection: sidebar (category/order)
 * order via the navigation machinery (#100/#143), with llms-eligible pages
 * the sidebar hides (`sidebar: false`) appended in path order.
 */
function collectionEntries(
    name: string,
    pages: LlmsPage[],
    config: SSGConfig,
    entryFor: (lp: LlmsPage) => LlmsEntry
): LlmsEntry[] {
    const collections = config.collections ?? {};
    const collection = collections[name];
    if (!collection) return [];

    const mdPages = pages.filter((lp) => lp.markdown);
    const byPath = new Map(mdPages.map((lp) => [routeKey(lp.page.path), lp]));

    // The navigation generator reads only path + meta, so synthetic routes
    // built from the prepared pages give the exact sidebar order for free.
    const synthetic = mdPages.map(
        (lp) =>
            ({
                path: lp.page.path,
                file: lp.page.source ?? '',
                name: lp.page.path,
                meta: lp.page.meta,
            }) as SSGRoute
    );
    const nav = generateNavigation(
        synthetic,
        collection.path,
        'never',
        false,
        normalizeSectionOrder(collection.sectionOrder ?? config.navigation?.sectionOrder),
        Object.values(collections).map((c) => c.path)
    );

    const ordered: LlmsPage[] = [];
    const seen = new Set<string>();
    const walk = (items: NavItem[]) => {
        for (const item of items) {
            if (item.href) {
                const lp = byPath.get(routeKey(item.href));
                if (lp && !seen.has(routeKey(lp.page.path))) {
                    seen.add(routeKey(lp.page.path));
                    ordered.push(lp);
                }
            }
            if (item.items) walk(item.items);
        }
    };
    for (const section of nav.sidebar) walk(section.items);

    const hidden = mdPages
        .filter(
            (lp) =>
                !seen.has(routeKey(lp.page.path)) &&
                detectCollection(lp.page.path, collections) === name
        )
        .sort((a, b) => a.page.path.localeCompare(b.page.path));

    return [...ordered, ...hidden].map((lp) => entryFor(lp));
}

/** Default sections: one per collection in declaration order, then `## Other`. */
function autoSections(
    pages: LlmsPage[],
    config: SSGConfig,
    entryFor: (lp: LlmsPage) => LlmsEntry
): ResolvedSection[] {
    const collections = config.collections ?? {};
    const sections: ResolvedSection[] = [];

    for (const name of Object.keys(collections)) {
        sections.push({
            title: routeToTitle(name),
            entries: collectionEntries(name, pages, config, entryFor),
        });
    }

    const other = pages
        .filter(
            (lp) => lp.markdown && detectCollection(lp.page.path, collections) === undefined
        )
        .sort((a, b) => a.page.path.localeCompare(b.page.path))
        .map((lp) => entryFor(lp));
    if (other.length > 0) sections.push({ title: 'Other', entries: other });

    return sections;
}

/** Expand curated sections: collections in sidebar order, exact pages, hand links. */
function resolveCuratedSections(
    curated: LlmsSection[],
    pages: LlmsPage[],
    byPath: Map<string, LlmsPage>,
    config: SSGConfig,
    entryFor: (lp: LlmsPage, note?: string) => LlmsEntry
): ResolvedSection[] {
    const base = config.base?.replace(/\/$/, '') || '';

    return curated.map((section) => {
        const entries: LlmsEntry[] = [];

        for (const name of section.collections ?? []) {
            entries.push(...collectionEntries(name, pages, config, entryFor));
        }

        for (const routePath of section.pages ?? []) {
            const lp = byPath.get(routeKey(routePath));
            if (lp) {
                entries.push(entryFor(lp));
            } else {
                console.warn(`⚠️  llms.sections: no built page matches '${routePath}'`);
            }
        }

        for (const link of section.links ?? []) {
            if (EXTERNAL_HREF.test(link.href)) {
                entries.push({ title: link.title, href: link.href, note: link.note });
                continue;
            }
            const lp = byPath.get(routeKey(link.href));
            entries.push({
                title: link.title,
                // Route links resolve to the page's .md rendition when one is
                // emitted; otherwise (e.g. a .tsx page) to the HTML route.
                href: lp
                    ? entryFor(lp).href
                    : `${base}${normalizePagePath(link.href, config.trailingSlash)}`,
                note: link.note,
            });
        }

        return { title: section.title, entries };
    });
}

/**
 * Generate llms-full.txt: the pages' renditions concatenated, each already
 * prefixed with its `---\nurl: …\n---` block. Pure.
 */
export function buildLlmsFullText(pages: LlmsPage[], options: LlmsFullOptions = {}): string {
    const included = options.include?.length ? createGlobMatcher(options.include) : () => true;
    const excluded = createGlobMatcher(options.exclude ?? []);

    const blocks = pages
        .filter((lp) => lp.markdown && included(lp.page.path) && !excluded(lp.page.path))
        .map((lp) => lp.markdown!.trimEnd());

    return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}

/**
 * Write every llms output into `outDir`: the per-page `.md` renditions,
 * `llms.txt`, `llms-full.txt`, and the per-area sub-indexes. Index files a
 * user ships via `public/` (already copied into `outDir`) are never
 * overwritten — same courtesy as robots.txt (#56).
 */
export async function writeLlmsOutputs(
    pages: PageBuildResult[],
    config: SSGConfig,
    outDir: string,
    options: LlmsOptions = {}
): Promise<{ files: string[]; warnings: string[] }> {
    const llmsPages = await prepareLlmsPages(pages, config, options);
    const files: string[] = [];
    const warnings: string[] = [];

    const writeGuarded = async (target: string, content: string) => {
        if (fsSync.existsSync(target)) return; // user file from public/ wins
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content, 'utf-8');
        files.push(target);
    };

    // Per-page .md renditions — derived artifacts, overwrite freely.
    if (options.pageMd !== false) {
        const emitted = new Set<string>();
        for (const lp of llmsPages) {
            if (!lp.markdown || !lp.mdPath) continue;
            if (emitted.has(lp.mdPath)) {
                // e.g. `/docs` and `/docs.html` both mapping to docs.md
                warnings.push(
                    `llms: markdown path collision — '${lp.page.path}' also maps to ${lp.mdPath}; kept the first page`
                );
                continue;
            }
            emitted.add(lp.mdPath);
            const target = path.join(outDir, lp.mdPath);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, lp.markdown, 'utf-8');
            files.push(target);
        }
    }

    if (options.index !== false) {
        await writeGuarded(path.join(outDir, 'llms.txt'), buildLlmsIndex(llmsPages, config, options));
    }

    if (options.full !== false) {
        const fullOptions = typeof options.full === 'object' ? options.full : {};
        const content = buildLlmsFullText(llmsPages, fullOptions);
        if (content) {
            await writeGuarded(path.join(outDir, fullOptions.output ?? 'llms-full.txt'), content);
        }
    }

    // Per-area sub-indexes: filtered re-invocations of the same builders.
    for (const [prefix, areaOptions] of Object.entries(options.areas ?? {})) {
        const areaPages = llmsPages.filter((lp) => isUnderCollectionPath(lp.page.path, prefix));
        if (areaPages.length === 0) {
            warnings.push(`llms.areas: no pages under '${prefix}' — skipped`);
            continue;
        }
        const areaDir = path.join(outDir, ...routeKey(prefix).split('/').filter(Boolean));
        const effective: LlmsOptions = {
            ...areaOptions,
            title: areaOptions.title ?? areaTitle(prefix, config),
            pageMd: options.pageMd,
        };

        if (effective.index !== false) {
            await writeGuarded(
                path.join(areaDir, 'llms.txt'),
                buildLlmsIndex(areaPages, config, effective)
            );
        }
        // Unlike the top level, an area's llms-full.txt is opt-in.
        if (areaOptions.full === true || typeof areaOptions.full === 'object') {
            const fullOptions = typeof areaOptions.full === 'object' ? areaOptions.full : {};
            const content = buildLlmsFullText(areaPages, fullOptions);
            if (content) {
                await writeGuarded(path.join(areaDir, fullOptions.output ?? 'llms-full.txt'), content);
            }
        }
    }

    return { files, warnings };
}
