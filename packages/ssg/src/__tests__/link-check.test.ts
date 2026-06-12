/**
 * Build-time internal link & anchor validation (signalxjs/ssg#99): dead
 * hrefs and dead `#fragment` anchors ship silently today — a real incident
 * on sigx.dev left ~45 dead anchors green in CI. The checker validates
 * every internal link against the emitted pages and their element ids.
 */

import { describe, it, expect } from 'vitest';
import { extractLocalLinks, extractElementIds, checkLinks, formatLinkCheckReport } from '../link-check';

const page = (path: string, html: string) => ({ path, html });

describe('extractLocalLinks (#99)', () => {
    it('collects internal hrefs and skips external/mailto/tel links', () => {
        const html = `
            <a href="/guide">g</a>
            <a href="/api#config">a</a>
            <a href="#local">l</a>
            <a href="https://example.com/x">ext</a>
            <a href="//cdn.example.com/y">proto-rel</a>
            <a href="mailto:hi@x.com">m</a>
            <a href="tel:+123">t</a>`;
        expect(extractLocalLinks(html)).toEqual(['/guide', '/api#config', '#local']);
    });
});

describe('extractElementIds (#99)', () => {
    it('collects every element id, not just headings', () => {
        const ids = extractElementIds('<h2 id="install">i</h2><div id="demo">d</div><a id="ref"></a>');
        expect(ids).toEqual(new Set(['install', 'demo', 'ref']));
    });
});

describe('checkLinks (#99)', () => {
    const SITE = [
        page('/', '<main><a href="/guide">guide</a><a href="/guide/#setup">setup</a></main>'),
        page('/guide', '<main><h2 id="setup">Setup</h2><a href="#setup">self</a><a href="/">home</a></main>'),
    ];

    it('passes a fully-valid site', () => {
        expect(checkLinks(SITE, {})).toEqual([]);
    });

    it('flags links to pages that do not exist', () => {
        const broken = checkLinks([page('/', '<a href="/no-such-page">x</a>')], {});
        expect(broken).toEqual([
            { page: '/', href: '/no-such-page', reason: 'missing-page' },
        ]);
    });

    it('flags fragments that do not exist on the target page', () => {
        const broken = checkLinks(
            [
                page('/', '<a href="/guide#nope">x</a><a href="/guide#setup">ok</a>'),
                page('/guide', '<h2 id="setup">s</h2>'),
            ],
            {}
        );
        expect(broken).toEqual([{ page: '/', href: '/guide#nope', reason: 'missing-anchor' }]);
    });

    it('checks same-page #fragments against the page itself', () => {
        const broken = checkLinks([page('/a', '<h2 id="real">r</h2><a href="#fake">x</a>')], {});
        expect(broken).toEqual([{ page: '/a', href: '#fake', reason: 'missing-anchor' }]);
    });

    it('is trailing-slash insensitive and ignores query strings', () => {
        const broken = checkLinks(
            [page('/', '<a href="/guide/">a</a><a href="/guide?tab=1#setup">b</a>'), page('/guide', '<h2 id="setup">s</h2>')],
            {}
        );
        expect(broken).toEqual([]);
    });

    it('strips the configured base before resolving', () => {
        const broken = checkLinks(
            [page('/', '<a href="/sub/guide">in-base</a><a href="/outside">outside</a>'), page('/guide', 'x')],
            { base: '/sub/' }
        );
        // /sub/guide resolves to /guide (exists); /outside is not under the
        // base, so it can't be one of our pages.
        expect(broken).toEqual([{ page: '/', href: '/outside', reason: 'missing-page' }]);
    });

    it('treats redirect sources as valid targets', () => {
        const broken = checkLinks([page('/', '<a href="/old-guide">x</a>')], {
            redirects: { '/old-guide': '/guide/' },
        });
        expect(broken).toEqual([]);
    });

    it('accepts asset links via the fileExists fallback', () => {
        const exists = (p: string) => p === '/logo.png';
        expect(checkLinks([page('/', '<a href="/logo.png">x</a>')], { fileExists: exists })).toEqual([]);
        expect(checkLinks([page('/', '<a href="/missing.pdf">x</a>')], { fileExists: exists })).toEqual([
            { page: '/', href: '/missing.pdf', reason: 'missing-page' },
        ]);
    });
});

describe('formatLinkCheckReport (#99)', () => {
    it('renders one file → href line per finding', () => {
        const report = formatLinkCheckReport([
            { page: '/docs/usage', href: '/api#screenheader', reason: 'missing-anchor' },
            { page: '/', href: '/typo', reason: 'missing-page' },
        ]);
        expect(report).toContain('/docs/usage → /api#screenheader (missing anchor)');
        expect(report).toContain('/ → /typo (missing page)');
        expect(report).toContain('2 broken internal link');
    });
});
