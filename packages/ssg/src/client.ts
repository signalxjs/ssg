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

// ============================================================================
// Package-manager switcher
// ============================================================================
//
// Shell install fences are rendered server-side (see `mdx/shiki.ts`) as a
// `.code-window-pm` window with an npm/pnpm/yarn/bun tab strip and all four
// command variants pre-rendered (non-default ones hidden inline). This client
// only flips which variant is visible and persists the choice — it never
// rewrites highlighted line text, so it can't fight framework hydration (the
// bug that broke the old docs-side DOM enhancer; see issue #40).

const PM_STORAGE_KEY = 'sigx-pm';
const VALID_PMS = ['pnpm', 'npm', 'yarn', 'bun'];

let pmSwitcherInstalled = false;

/** Read the persisted manager, or null when unset/invalid/unavailable. */
function readStoredPm(): string | null {
    try {
        const v = localStorage.getItem(PM_STORAGE_KEY);
        return v && VALID_PMS.includes(v) ? v : null;
    } catch {
        return null;
    }
}

/** Show the chosen variant + mark its tab active in every PM window. */
function applyPm(pm: string): void {
    for (const win of document.querySelectorAll<HTMLElement>('.code-window-pm')) {
        if (win.dataset.pm === pm) continue; // already applied — skip redundant DOM writes
        win.dataset.pm = pm;
        for (const variant of win.querySelectorAll<HTMLElement>('[data-pm-variant]')) {
            variant.style.display = variant.dataset.pmVariant === pm ? '' : 'none';
        }
        for (const tab of win.querySelectorAll<HTMLElement>('.code-window-pm-tab')) {
            const active = tab.dataset.pm === pm;
            tab.classList.toggle('code-window-tab-active', active);
            tab.setAttribute('aria-selected', String(active));
        }
    }
}

/** Inject the minimal functional layout for the tab strip once (themeable). */
function injectPmStyles(): void {
    const id = 'sigx-pm-switcher-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent =
        '.code-window-pm-tabs{display:inline-flex;gap:.25rem}.code-window-pm-tab{cursor:pointer}';
    document.head.appendChild(style);
}

/**
 * Mount the package-manager switcher. Idempotent and client-only; called from
 * the generated client entry after hydration (custom entries can call it
 * themselves). It registers a few page-wide listeners (a delegated click
 * handler, a `storage` listener, and a coalesced `MutationObserver`) once;
 * pages with no install fences keep these but do no visible work.
 *
 * Returns a disposer that removes the listeners and observer (useful for HMR or
 * teardown); calling it again re-enables installation.
 */
export function installPackageManagerSwitcher(): () => void {
    const noop = () => {};
    // Needs both `document` and `window` (storage events / localStorage); some
    // non-browser runtimes shim one without the other.
    if (pmSwitcherInstalled || typeof document === 'undefined' || typeof window === 'undefined') {
        return noop;
    }
    pmSwitcherInstalled = true;

    injectPmStyles();

    // The active selection, cached so the MutationObserver never has to touch
    // localStorage on the hydration / navigation hot path. Updated on clicks
    // and cross-tab storage events.
    let currentPm = readStoredPm();

    const sync = () => {
        if (currentPm) applyPm(currentPm);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync, { once: true });
    } else {
        sync();
    }

    // Re-apply to windows mounted after first paint (SPA navigation, late
    // hydration). Coalesced; only `childList` is observed, so the attribute /
    // style writes `applyPm` makes don't re-trigger it, and the `data-pm`
    // guard makes rescans cheap.
    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled || !currentPm) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            sync();
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Switch on tab click — delegated, so windows added later work too.
    const onClick = (e: MouseEvent) => {
        // `e.target` can be a non-Element (e.g. a Text node); `.closest` only
        // exists on Elements, so guard before calling it.
        if (!(e.target instanceof Element)) return;
        const tab = e.target.closest<HTMLElement>('.code-window-pm-tab');
        const pm = tab?.dataset.pm;
        if (!pm || !VALID_PMS.includes(pm)) return;
        currentPm = pm;
        applyPm(pm);
        try {
            localStorage.setItem(PM_STORAGE_KEY, pm);
        } catch {
            /* storage unavailable — selection still applies for this session */
        }
    };
    document.addEventListener('click', onClick);

    // Cross-tab / cross-page sync.
    const onStorage = (e: StorageEvent) => {
        if (e.key === PM_STORAGE_KEY && e.newValue && VALID_PMS.includes(e.newValue)) {
            currentPm = e.newValue;
            applyPm(e.newValue);
        }
    };
    window.addEventListener('storage', onStorage);

    return () => {
        observer.disconnect();
        document.removeEventListener('click', onClick);
        window.removeEventListener('storage', onStorage);
        pmSwitcherInstalled = false;
    };
}
