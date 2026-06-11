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
        const a = makeAnchor({ href: '/guide' });
        const event = click(a);
        expect(push).toHaveBeenCalledWith('/guide');
        expect(event.defaultPrevented).toBe(true);
    });

    it('preserves search and hash on internal navigations', () => {
        const a = makeAnchor({ href: '/guide?tab=1#install' });
        click(a);
        expect(push).toHaveBeenCalledWith('/guide?tab=1#install');
    });

    it('works for clicks on elements nested inside the anchor', () => {
        const a = makeAnchor({ href: '/docs/getting-started' });
        const span = document.createElement('span');
        span.textContent = 'nested';
        a.appendChild(span);
        click(span);
        expect(push).toHaveBeenCalledWith('/docs/getting-started');
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
        expect(push).toHaveBeenCalledWith('/guide?tab=1#section');
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
        expect(push).toHaveBeenCalledWith('/guide');
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
