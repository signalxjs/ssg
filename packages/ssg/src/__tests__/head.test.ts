import { describe, it, expect } from 'vitest';
import { generateHeadTags } from '../head';
import type { SSGConfig, PageMeta } from '../types';

const SITE: SSGConfig = {
    base: '/',
    site: {
        title: 'My Site',
        description: 'Site description',
        url: 'https://example.com',
        twitter: 'handle',
    },
};

function gen(meta: PageMeta = {}, config: SSGConfig = SITE, path = '/guide'): string {
    return generateHeadTags({ path, route: { meta } }, config);
}

describe('generateHeadTags — baseline (no SEO fields)', () => {
    it('emits the same core tags as before', () => {
        const html = gen({ title: 'Guide', description: 'A guide' });
        expect(html).toContain('<title>Guide</title>');
        expect(html).toContain('<meta name="description" content="A guide">');
        expect(html).toContain('<link rel="canonical" href="https://example.com/guide">');
        expect(html).toContain('<meta property="og:title" content="Guide">');
        expect(html).toContain('<meta name="twitter:title" content="Guide">');
    });

    it('emits no robots/keywords/jsonLd tags when those fields are absent', () => {
        const html = gen({ title: 'Guide' });
        expect(html).not.toContain('name="robots"');
        expect(html).not.toContain('name="keywords"');
        expect(html).not.toContain('application/ld+json');
    });

    it('falls back to site title/description', () => {
        const html = gen({});
        expect(html).toContain('<title>My Site</title>');
        expect(html).toContain('<meta name="description" content="Site description">');
    });
});

describe('generateHeadTags — JSON-LD', () => {
    it('renders a single object as one ld+json script', () => {
        const html = gen({ jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite' } });
        expect(html).toContain(
            '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>'
        );
    });

    it('renders an array as one script per object', () => {
        const html = gen({ jsonLd: [{ '@type': 'A' }, { '@type': 'B' }] });
        const scripts = html.match(/application\/ld\+json/g) || [];
        expect(scripts).toHaveLength(2);
        expect(html).toContain('{"@type":"A"}');
        expect(html).toContain('{"@type":"B"}');
    });

    it('escapes < to prevent </script> breakout', () => {
        const html = gen({ jsonLd: { name: '</script><script>alert(1)' } });
        expect(html).not.toContain('</script><script>alert(1)');
        expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)');
    });

    it('applies site-wide jsonLd to every page', () => {
        const config: SSGConfig = { ...SITE, site: { ...SITE.site, jsonLd: { '@type': 'Organization' } } };
        const html = gen({}, config);
        expect(html).toContain('{"@type":"Organization"}');
    });

    it('emits site-wide jsonLd before per-page jsonLd', () => {
        const config: SSGConfig = { ...SITE, site: { ...SITE.site, jsonLd: { '@type': 'Site' } } };
        const html = gen({ jsonLd: { '@type': 'Page' } }, config);
        expect(html.indexOf('"Site"')).toBeLessThan(html.indexOf('"Page"'));
    });
});

describe('generateHeadTags — custom head tags', () => {
    it('injects arbitrary meta/link after the auto tags', () => {
        const html = gen({
            title: 'Guide',
            head: [
                { tag: 'meta', attrs: { name: 'author', content: 'Jane' } },
                { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.example' } },
            ],
        });
        expect(html).toContain('<meta name="author" content="Jane">');
        expect(html).toContain('<link rel="preconnect" href="https://fonts.example">');
        expect(html.indexOf('<title>')).toBeLessThan(html.indexOf('name="author"'));
    });

    it('renders non-void tags with raw children', () => {
        const html = gen({ head: [{ tag: 'style', children: '.x{color:red}' }] });
        expect(html).toContain('<style>.x{color:red}</style>');
    });

    it('escapes attribute values', () => {
        const html = gen({ head: [{ tag: 'meta', attrs: { name: 'x', content: '"<>&' } }] });
        expect(html).toContain('content="&quot;&lt;&gt;&amp;"');
    });

    it('applies site-wide head tags to every page', () => {
        const config: SSGConfig = {
            ...SITE,
            site: { ...SITE.site, head: [{ tag: 'meta', attrs: { name: 'global', content: 'yes' } }] },
        };
        const html = gen({}, config);
        expect(html).toContain('<meta name="global" content="yes">');
    });
});

describe('generateHeadTags — overrides', () => {
    it('meta.canonical overrides the derived canonical', () => {
        const html = gen({ canonical: 'https://example.com/custom' });
        expect(html).toContain('<link rel="canonical" href="https://example.com/custom">');
        expect(html).not.toContain('href="https://example.com/guide"');
        expect(html).toContain('<meta property="og:url" content="https://example.com/custom">');
    });

    it('meta.robots emits a robots directive', () => {
        const html = gen({ robots: 'noindex, nofollow' });
        expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    });

    it('meta.keywords accepts a string', () => {
        const html = gen({ keywords: 'a, b' });
        expect(html).toContain('<meta name="keywords" content="a, b">');
    });

    it('meta.keywords accepts an array (joined with ", ")', () => {
        const html = gen({ keywords: ['signals', 'ssg'] });
        expect(html).toContain('<meta name="keywords" content="signals, ssg">');
    });
});

describe('generateHeadTags — dedup', () => {
    it('does not double-emit a canonical provided via head[]', () => {
        const html = gen({
            canonical: 'https://example.com/custom',
            head: [{ tag: 'link', attrs: { rel: 'canonical', href: 'https://example.com/dupe' } }],
        });
        const canonicals = html.match(/rel="canonical"/g) || [];
        expect(canonicals).toHaveLength(1);
        expect(html).toContain('href="https://example.com/custom"');
        expect(html).not.toContain('https://example.com/dupe');
    });

    it('does not double-emit a description provided via head[]', () => {
        const html = gen({
            description: 'Real',
            head: [{ tag: 'meta', attrs: { name: 'description', content: 'Dupe' } }],
        });
        const descs = html.match(/name="description"/g) || [];
        expect(descs).toHaveLength(1);
        expect(html).toContain('content="Real"');
    });
});
