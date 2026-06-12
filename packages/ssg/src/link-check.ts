/**
 * Build-time internal link & anchor validation (signalxjs/ssg#99).
 *
 * After rendering, every internal `<a href>` is checked against the emitted
 * pages and their element ids: a dead path or a `#fragment` with no matching
 * id is reported as `page → href (reason)`. `linkCheck: 'warn' | 'error'`
 * controls whether findings warn or fail the build (default `warn`).
 *
 * External (`http(s)`, protocol-relative) and `mailto:`/`tel:`-style links
 * are skipped. Redirect sources count as valid targets; anything else that
 * isn't a rendered page falls back to an on-disk existence check (public/
 * assets).
 */

export interface BrokenLink {
    /** Path of the page containing the link. */
    page: string;
    /** The offending href, verbatim. */
    href: string;
    reason: 'missing-page' | 'missing-anchor';
}

export interface LinkCheckOptions {
    /** Deploy base — stripped from hrefs before resolving. */
    base?: string;
    /** Redirect sources (config.redirects keys) are valid link targets. */
    redirects?: Record<string, string>;
    /**
     * Fallback for hrefs that aren't rendered pages — return true when the
     * path exists in the build output (public/ assets, downloads).
     */
    fileExists?: (path: string) => boolean;
}

/** Internal hrefs in the HTML — externals and scheme links are skipped. */
export function extractLocalLinks(html: string): string[] {
    const links: string[] = [];
    for (const m of html.matchAll(/<a\s[^>]*?href="([^"]*)"/gi)) {
        const href = m[1];
        if (!href) continue;
        if (href.startsWith('//')) continue; // protocol-relative external
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // http:, mailto:, tel:, …
        links.push(href);
    }
    return links;
}

/** Every element id in the HTML — anchors may target any element. */
export function extractElementIds(html: string): Set<string> {
    const ids = new Set<string>();
    for (const m of html.matchAll(/<[a-z][^>]*?\bid="([^"]+)"/gi)) {
        ids.add(m[1]);
    }
    return ids;
}

/** `/guide/` and `/guide` are the same emitted page. */
function normalizePath(path: string): string {
    if (path === '' || path === '/') return '/';
    return path.replace(/\/+$/, '');
}

/** Validate all internal links across the rendered pages. */
export function checkLinks(
    docs: Array<{ path: string; html: string }>,
    options: LinkCheckOptions = {}
): BrokenLink[] {
    const base = options.base && options.base !== '/' ? options.base.replace(/\/+$/, '') : '';

    const idsByPath = new Map<string, Set<string>>();
    for (const doc of docs) {
        idsByPath.set(normalizePath(doc.path), extractElementIds(doc.html));
    }
    const redirectSources = new Set(Object.keys(options.redirects ?? {}).map(normalizePath));

    const broken: BrokenLink[] = [];

    for (const doc of docs) {
        for (const href of extractLocalLinks(doc.html)) {
            // Split off fragment and query (query never affects static targets).
            const hashIndex = href.indexOf('#');
            const fragment = hashIndex === -1 ? null : href.slice(hashIndex + 1);
            let pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
            const queryIndex = pathPart.indexOf('?');
            if (queryIndex !== -1) pathPart = pathPart.slice(0, queryIndex);

            // Resolve the target page: same page for pure-fragment links,
            // else strip the base and look it up.
            let targetPath: string;
            if (pathPart === '') {
                targetPath = normalizePath(doc.path);
            } else {
                let p = pathPart;
                if (base) {
                    if (p === base) p = '/';
                    else if (p.startsWith(base + '/')) p = p.slice(base.length);
                    // Links outside the base can't be ours — fall through and
                    // let the page lookup fail.
                }
                targetPath = normalizePath(p);
            }

            const targetIds = idsByPath.get(targetPath);
            if (!targetIds) {
                if (redirectSources.has(targetPath)) continue; // meta-refresh page exists
                if (options.fileExists?.(targetPath)) continue; // public/ asset
                broken.push({ page: doc.path, href, reason: 'missing-page' });
                continue;
            }
            if (fragment && !targetIds.has(fragment)) {
                broken.push({ page: doc.path, href, reason: 'missing-anchor' });
            }
        }
    }

    return broken;
}

/** Human-readable report: one `page → href (reason)` line per finding. */
export function formatLinkCheckReport(broken: BrokenLink[]): string {
    const lines = broken.map(
        (b) => `  ${b.page} → ${b.href} (${b.reason === 'missing-page' ? 'missing page' : 'missing anchor'})`
    );
    return `${broken.length} broken internal link(s):\n${lines.join('\n')}`;
}
