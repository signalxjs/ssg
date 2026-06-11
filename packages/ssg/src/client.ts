/**
 * SSG Client Runtime
 *
 * Client-side utilities for SSG sites:
 * - Hydration plugin
 * - Route prefetching
 * - Client-side navigation
 */

export { ssrClientPlugin } from '@sigx/server-renderer/client';

// Package-manager command parsing/translation — public API (#63). Pure and
// dependency-free; the same functions the build-time switcher uses.
import { DEFAULT_PM, type Pm } from './mdx/package-manager';
export {
    parse as parsePackageManagerCommand,
    render as renderPackageManagerCommand,
    translate as translatePackageManagerCommand,
    PMS as PACKAGE_MANAGERS,
    DEFAULT_PM as DEFAULT_PACKAGE_MANAGER,
} from './mdx/package-manager';
export type { Pm, Parsed as ParsedPackageManagerCommand } from './mdx/package-manager';

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
// SPA navigation for internal anchors (#35)
// ============================================================================

/** The slice of the router installSpaNavigation needs. */
export interface SpaNavigationRouter {
    push(path: string): unknown;
}

export interface SpaNavigationOptions {
    /**
     * The site's base path (same value as the router's history base). Anchor
     * hrefs carry the base on subpath deploys; it is stripped before push.
     * @default '/'
     */
    base?: string;
}

/**
 * Route same-origin internal anchor clicks through the router instead of
 * full page reloads (#35). MDX content links compile to bare `<a>` elements
 * and `@sigx/router` only wires its own RouterLink component — without this,
 * every content/layout link is an MPA navigation.
 *
 * One delegated listener on `document`; the browser keeps handling:
 * - modified clicks (ctrl/meta/shift/alt, non-primary buttons)
 * - clicks something else already handled (`defaultPrevented` — RouterLink)
 * - external origins, `mailto:`/`tel:` etc.
 * - `target` (other than `_self`), `download`, and `data-no-spa` anchors
 *   (the attribute opts out the anchor or any ancestor container)
 * - pure-hash and same-page `#hash` links (native scroll)
 *
 * Returns an uninstall function. Wired automatically into the generated
 * client entry; call it yourself in custom entries.
 */
export function installSpaNavigation(
    router: SpaNavigationRouter,
    options: SpaNavigationOptions = {}
): () => void {
    if (typeof document === 'undefined') return () => {};

    const base = options.base && options.base !== '/' ? options.base.replace(/\/+$/, '') : '';

    const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const anchor = (event.target as Element | null)?.closest?.('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        // data-no-spa opts out the anchor itself OR any ancestor container
        // (e.g. live-code preview islands rendering arbitrary example markup).
        if (anchor.hasAttribute('download') || anchor.closest('[data-no-spa]')) return;
        const target = anchor.getAttribute('target');
        if (target && target !== '_self') return;

        let url: URL;
        try {
            url = new URL(anchor.href, location.href);
        } catch {
            return;
        }
        if (url.origin !== location.origin) return; // external, mailto:, tel:, …

        // Same-document hash (same pathname AND search, only the fragment
        // differs) → let the browser scroll natively. A differing query
        // string is a real navigation and must stay intercepted.
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

        // Strip the base at a path boundary; links outside it are not ours.
        let path = url.pathname;
        if (base) {
            if (path === base) path = '/';
            else if (path.startsWith(base + '/')) path = path.slice(base.length);
            else return;
        }

        event.preventDefault();
        void router.push(path + url.search + url.hash);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
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

/**
 * The active selection, shared between the switcher UI and the public API
 * (#63). Lazily seeded from localStorage; null until anything reads/sets it.
 */
let activePm: string | null = null;

const pmListeners = new Set<(pm: Pm) => void>();

function notifyPmChange(pm: Pm): void {
    for (const listener of pmListeners) listener(pm);
}

/** Internal: adopt a (validated) selection — DOM, persistence, listeners. */
function adoptPm(pm: Pm, persist: boolean): void {
    activePm = pm;
    applyPm(pm);
    if (persist) {
        try {
            localStorage.setItem(PM_STORAGE_KEY, pm);
        } catch {
            /* storage unavailable — selection still applies for this session */
        }
    }
    notifyPmChange(pm);
}

/**
 * The currently selected package manager: the in-page selection, else the
 * persisted one, else the first PM window's server-rendered default, else
 * `'pnpm'` (#63).
 */
export function getPackageManager(): Pm {
    if (activePm) return activePm as Pm;
    const stored = readStoredPm();
    if (stored) return stored as Pm;
    const win = typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>('.code-window-pm[data-pm]')
        : null;
    const fromDom = win?.dataset.pm;
    return (fromDom && VALID_PMS.includes(fromDom) ? fromDom : DEFAULT_PM) as Pm;
}

/**
 * Programmatically select a package manager — updates every switcher window,
 * persists the choice, and notifies subscribers (#63).
 */
export function setPackageManager(pm: Pm): void {
    if (!VALID_PMS.includes(pm)) {
        throw new TypeError(`setPackageManager: unknown package manager "${pm}" (expected ${VALID_PMS.join(' | ')})`);
    }
    adoptPm(pm, true);
}

/**
 * Subscribe to package-manager changes (tab clicks, programmatic sets,
 * cross-tab sync). Returns an unsubscribe function (#63).
 */
export function onPackageManagerChange(listener: (pm: Pm) => void): () => void {
    pmListeners.add(listener);
    return () => pmListeners.delete(listener);
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

    // Seed the shared selection so the MutationObserver never has to touch
    // localStorage on the hydration / navigation hot path. Updated on clicks,
    // programmatic sets, and cross-tab storage events.
    if (!activePm) activePm = readStoredPm();

    const sync = () => {
        if (activePm) applyPm(activePm);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync, { once: true });
    } else {
        sync();
    }

    // Re-apply to windows mounted after first paint (SPA navigation, late
    // hydration). Coalesced; only `childList` is observed, so the attribute /
    // style writes `applyPm` makes don't re-trigger it. We resync only when an
    // added node actually is/contains a `.code-window-pm`, so unrelated DOM
    // churn on interactive pages stays cheap even after a manager is chosen.
    let scheduled = false;
    const addsPmWindow = (records: MutationRecord[]): boolean => {
        for (const rec of records) {
            for (const node of rec.addedNodes) {
                if (
                    node instanceof Element &&
                    (node.matches('.code-window-pm') || node.querySelector('.code-window-pm'))
                ) {
                    return true;
                }
            }
        }
        return false;
    };
    const observer = new MutationObserver((records) => {
        if (scheduled || !activePm || !addsPmWindow(records)) return;
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
        adoptPm(pm as Pm, true);
    };
    document.addEventListener('click', onClick);

    // Cross-tab / cross-page sync.
    const onStorage = (e: StorageEvent) => {
        if (e.key === PM_STORAGE_KEY && e.newValue && VALID_PMS.includes(e.newValue)) {
            adoptPm(e.newValue as Pm, false); // already persisted by the other tab
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
