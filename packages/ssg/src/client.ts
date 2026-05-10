/**
 * SSG Client Runtime
 *
 * Client-side utilities for SSG sites:
 * - Hydration plugin
 * - Route prefetching
 * - Client-side navigation
 */

export { ssrClientPlugin } from '@sigx/server-renderer/client';

/**
 * Prefetch a route's assets
 */
export function prefetch(path: string): void {
    // Create a link element for prefetching
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = path;
    document.head.appendChild(link);
}

/**
 * Setup prefetch on link hover
 */
export function setupPrefetch(options: { delay?: number } = {}): void {
    const { delay = 100 } = options;
    const prefetched = new Set<string>();

    document.addEventListener('mouseover', (event) => {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) return;
        if (prefetched.has(href)) return;

        // Delay prefetch slightly to avoid unnecessary requests
        const timeoutId = setTimeout(() => {
            prefetched.add(href);
            prefetch(href);
        }, delay);

        anchor.addEventListener(
            'mouseleave',
            () => clearTimeout(timeoutId),
            { once: true }
        );
    });
}

/**
 * Check if the page was statically generated
 */
export function isStaticPage(): boolean {
    return !document.documentElement.hasAttribute('data-ssr');
}

/**
 * Get initial state embedded in the page
 */
export function getInitialState<T = Record<string, unknown>>(): T | null {
    const script = document.getElementById('__SSG_STATE__');
    if (!script) return null;

    try {
        return JSON.parse(script.textContent || '');
    } catch {
        return null;
    }
}
