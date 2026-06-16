/**
 * Regression coverage for signalxjs/ssg#35: internal anchor clicks did full
 * page reloads — @sigx/router only wires its own RouterLink component and
 * MDX content links compile to bare `<a>` intrinsics, so there was no SPA
 * navigation at all. `installSpaNavigation` adds ONE delegated listener
 * routing same-origin anchors through the router.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installSpaNavigation } from '../client';

type PushFn = ReturnType<typeof vi.fn<(path: string) => unknown>>;

let push: PushFn;
let uninstall: () => void;


function makeAnchor(attrs: Record<string, string>): HTMLAnchorElement {
    const a = document.createElement('a');
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    a.textContent = 'link';
    document.body.appendChild(a);
    return a;
}

function click(el: Element, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    el.dispatchEvent(event);
    return event;
}

beforeEach(() => {
    // happy-dom performs its own navigation on anchor clicks (independent of
    // delegated preventDefault), which would move `location` between cases —
    // pin the URL before every test.
    (window as any).happyDOM?.setURL?.('http://localhost:3000/');
    document.body.innerHTML = '';
    push = vi.fn<(path: string) => unknown>();
    uninstall = installSpaNavigation({ push });
});

afterEach(() => {
    uninstall();
});

describe('installSpaNavigation (#35)', () => {
    it('routes internal anchor clicks through the router', () => {
        // Default trailingSlash is 'always', so the slash-less href is
        // normalised to the canonical trailing-slash form (#163).
        const a = makeAnchor({ href: '/guide' });
        const event = click(a);
        expect(push).toHaveBeenCalledWith('/guide/');
        expect(event.defaultPrevented).toBe(true);
    });

    it('preserves search and hash on internal navigations', () => {
        const a = makeAnchor({ href: '/guide?tab=1#install' });
        click(a);
        expect(push).toHaveBeenCalledWith('/guide/?tab=1#install');
    });

    it('works for clicks on elements nested inside the anchor', () => {
        const a = makeAnchor({ href: '/docs/getting-started' });
        const span = document.createElement('span');
        span.textContent = 'nested';
        a.appendChild(span);
        click(span);
        expect(push).toHaveBeenCalledWith('/docs/getting-started/');
    });

    it('ignores external links', () => {
        click(makeAnchor({ href: 'https://example.com/x' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('ignores mailto links', () => {
        click(makeAnchor({ href: 'mailto:hi@example.com' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('ignores same-page hash links (native scroll)', () => {
        // location.pathname is '/' (pinned in beforeEach)
        click(makeAnchor({ href: '/#section' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('intercepts hash links whose query string differs (real navigation)', () => {
        (window as any).happyDOM?.setURL?.('http://localhost:3000/guide?tab=2');
        click(makeAnchor({ href: '/guide?tab=1#section' }));
        expect(push).toHaveBeenCalledWith('/guide/?tab=1#section');
    });

    it('ignores pure-hash links', () => {
        click(makeAnchor({ href: '#section' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('ignores target=_blank, download, and data-no-spa links', () => {
        click(makeAnchor({ href: '/a', target: '_blank' }));
        click(makeAnchor({ href: '/b', download: '' }));
        click(makeAnchor({ href: '/c', 'data-no-spa': '' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('ignores modified clicks (new-tab gestures)', () => {
        const a = makeAnchor({ href: '/guide' });
        click(a, { ctrlKey: true });
        click(a, { metaKey: true });
        click(a, { shiftKey: true });
        click(a, { button: 1 });
        expect(push).not.toHaveBeenCalled();
    });

    it('leaves already-handled clicks alone (RouterLink calls preventDefault)', () => {
        const a = makeAnchor({ href: '/guide' });
        a.addEventListener('click', (e) => e.preventDefault());
        click(a);
        expect(push).not.toHaveBeenCalled();
    });

    it('strips the base prefix on subpath deploys', () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { base: '/docs/' });
        click(makeAnchor({ href: '/docs/guide' }));
        expect(push).toHaveBeenCalledWith('/guide/');
    });

    it('does not intercept paths outside the base', () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { base: '/docs/' });
        click(makeAnchor({ href: '/elsewhere' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('uninstall removes the listener', () => {
        uninstall();
        click(makeAnchor({ href: '/guide' }));
        expect(push).not.toHaveBeenCalled();
        uninstall = installSpaNavigation({ push });
    });
});

describe('trailingSlash normalization (#163)', () => {
    it("'always' (default) adds the trailing slash for extension-less routes", () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'always' });
        click(makeAnchor({ href: '/core/api' }));
        expect(push).toHaveBeenCalledWith('/core/api/');
    });

    it('leaves an already-canonical trailing-slash path unchanged', () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'always' });
        click(makeAnchor({ href: '/core/api/' }));
        expect(push).toHaveBeenCalledWith('/core/api/');
    });

    it("'never' strips the trailing slash instead", () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'never' });
        click(makeAnchor({ href: '/core/api/' }));
        expect(push).toHaveBeenCalledWith('/core/api');
    });

    it("'never' leaves an already slash-less path unchanged", () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'never' });
        click(makeAnchor({ href: '/core/api' }));
        expect(push).toHaveBeenCalledWith('/core/api');
    });

    it('does not touch the root path', () => {
        (window as any).happyDOM?.setURL?.('http://localhost:3000/guide');
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'always' });
        click(makeAnchor({ href: '/' }));
        expect(push).toHaveBeenCalledWith('/');
    });

    it('pushes paths with a file extension verbatim (no slash appended)', () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'always' });
        click(makeAnchor({ href: '/sitemap.xml' }));
        click(makeAnchor({ href: '/fonts/inter.woff2' }));
        expect(push).toHaveBeenNthCalledWith(1, '/sitemap.xml');
        expect(push).toHaveBeenNthCalledWith(2, '/fonts/inter.woff2');
    });

    it('still normalises dotted version routes (numeric extension is not a file)', () => {
        // `/v1.0` / `/docs/2.1` are routes, not files — appending the slash
        // keeps them aligned with the 301 canonical form (#163, review).
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'always' });
        click(makeAnchor({ href: '/v1.0' }));
        click(makeAnchor({ href: '/docs/2.1' }));
        expect(push).toHaveBeenNthCalledWith(1, '/v1.0/');
        expect(push).toHaveBeenNthCalledWith(2, '/docs/2.1/');
    });

    it('preserves search and hash alongside the added slash', () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { trailingSlash: 'always' });
        click(makeAnchor({ href: '/guide?tab=1#install' }));
        expect(push).toHaveBeenCalledWith('/guide/?tab=1#install');
    });

    it('normalises after stripping the base on subpath deploys', () => {
        uninstall();
        uninstall = installSpaNavigation({ push }, { base: '/docs/', trailingSlash: 'always' });
        click(makeAnchor({ href: '/docs/guide' }));
        expect(push).toHaveBeenCalledWith('/guide/');
    });
});

describe('generated client entry wiring (#35)', () => {
    it('installs SPA navigation by default', async () => {
        const { generateClientEntry } = await import('../vite/virtual-entries');
        const code = generateClientEntry({ base: '/' }, {
            useVirtualClient: true,
            useVirtualServer: true,
            useVirtualHtml: true,
        });
        expect(code).toContain('installSpaNavigation(router');
    });

    it('passes the configured trailingSlash into installSpaNavigation (#163)', async () => {
        const { generateClientEntry } = await import('../vite/virtual-entries');
        const code = generateClientEntry({ base: '/', trailingSlash: 'never' }, {
            useVirtualClient: true,
            useVirtualServer: true,
            useVirtualHtml: true,
        });
        expect(code).toMatch(/installSpaNavigation\(router, \{[^}]*trailingSlash: 'never'/);
    });

    it("defaults the entry's trailingSlash to 'always' (#163)", async () => {
        const { generateClientEntry } = await import('../vite/virtual-entries');
        const code = generateClientEntry({ base: '/' }, {
            useVirtualClient: true,
            useVirtualServer: true,
            useVirtualHtml: true,
        });
        expect(code).toMatch(/installSpaNavigation\(router, \{[^}]*trailingSlash: 'always'/);
    });

    it('omits it when spaNavigation: false', async () => {
        const { generateClientEntry } = await import('../vite/virtual-entries');
        const code = generateClientEntry({ base: '/', spaNavigation: false }, {
            useVirtualClient: true,
            useVirtualServer: true,
            useVirtualHtml: true,
        });
        expect(code).not.toContain('installSpaNavigation');
    });
});

describe('container-level data-no-spa (#95)', () => {
    it('skips anchors inside a data-no-spa container', () => {
        const container = document.createElement('div');
        container.setAttribute('data-no-spa', '');
        const a = document.createElement('a');
        a.setAttribute('href', '/guide');
        a.textContent = 'preview link';
        container.appendChild(a);
        document.body.appendChild(container);

        click(a);
        expect(push).not.toHaveBeenCalled();
    });

    it('still intercepts anchors outside such containers', () => {
        const container = document.createElement('div');
        container.setAttribute('data-no-spa', '');
        document.body.appendChild(container);

        click(makeAnchor({ href: '/guide' }));
        expect(push).toHaveBeenCalledWith('/guide/');
    });
});
