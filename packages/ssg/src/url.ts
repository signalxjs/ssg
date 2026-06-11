/**
 * Public-URL path normalization
 *
 * Single source of truth for how a route path appears in public URLs
 * (canonical, og:url, sitemap <loc>). Folder routes are emitted as
 * `<path>/index.html`, so the URL a static host serves with 200 is
 * `/about/` — declared URLs must match or every one of them is a 301
 * (signalxjs/ssg#41).
 */

export type TrailingSlash = 'always' | 'never';

/**
 * Normalize a route path for use in a public URL.
 *
 * - `'always'` (default, matches the `<path>/index.html` output layout):
 *   `/about` → `/about/`; the root `/` and explicit `.html` paths are
 *   left untouched.
 * - `'never'`: trailing slashes are stripped instead (`/about/` → `/about`).
 */
export function normalizePagePath(path: string, trailingSlash: TrailingSlash = 'always'): string {
    if (path === '/' || path === '') return '/';
    if (path.endsWith('.html')) return path;

    const stripped = path.replace(/\/+$/, '');
    if (stripped === '') return '/';

    return trailingSlash === 'always' ? `${stripped}/` : stripped;
}
