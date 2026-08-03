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
        expect(html).toContain('<link rel="canonical" href="https://example.com/guide/">');
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

describe('generateHeadTags — canonical URL normalization (#41)', () => {
    it('derived canonical and og:url carry a trailing slash for folder routes', () => {
        const html = gen({ title: 'Guide' });
        expect(html).toContain('<link rel="canonical" href="https://example.com/guide/">');
        expect(html).toContain('<meta property="og:url" content="https://example.com/guide/">');
    });

    it('root path canonical is the bare origin with a single slash', () => {
        const html = gen({ title: 'Home' }, SITE, '/');
        expect(html).toContain('<link rel="canonical" href="https://example.com/">');
    });

    it('.html routes keep their path verbatim', () => {
        const html = gen({ title: 'Page' }, SITE, '/foo.html');
        expect(html).toContain('<link rel="canonical" href="https://example.com/foo.html">');
    });

    it('base path is prefixed before the normalized path', () => {
        const html = gen({ title: 'Guide' }, { ...SITE, base: '/docs/' });
        expect(html).toContain('<link rel="canonical" href="https://example.com/docs/guide/">');
    });

    it("trailingSlash: 'never' preserves the old slash-less URLs", () => {
        const html = gen({ title: 'Guide' }, { ...SITE, trailingSlash: 'never' });
        expect(html).toContain('<link rel="canonical" href="https://example.com/guide">');
    });

    it('a per-page meta.canonical is never rewritten', () => {
        const html = gen({ canonical: 'https://example.com/exact' });
        expect(html).toContain('<link rel="canonical" href="https://example.com/exact">');
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

    it('keeps repeated custom tags (no custom-vs-custom dedup)', () => {
        const html = gen({
            head: [
                { tag: 'link', attrs: { rel: 'preload', href: '/a.woff2' } },
                { tag: 'link', attrs: { rel: 'preload', href: '/b.woff2' } },
            ],
        });
        expect(html).toContain('<link rel="preload" href="/a.woff2">');
        expect(html).toContain('<link rel="preload" href="/b.woff2">');
        expect((html.match(/rel="preload"/g) || [])).toHaveLength(2);
    });

    it('normalizes an upper-cased tag name and treats it as void', () => {
        const html = gen({ head: [{ tag: 'META', attrs: { name: 'author', content: 'Jane' } }] });
        expect(html).toContain('<meta name="author" content="Jane">');
        expect(html).not.toContain('</META>');
        expect(html).not.toContain('</meta>');
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

    it('dedupes case-insensitively against the auto canonical', () => {
        const html = gen({
            canonical: 'https://example.com/custom',
            head: [{ tag: 'link', attrs: { rel: 'Canonical', href: 'https://example.com/dupe' } }],
        });
        expect(html).not.toContain('https://example.com/dupe');
        expect(html).toContain('href="https://example.com/custom"');
    });
});

describe('generateHeadTags — per-page OG overrides (#206)', () => {
    it('meta.ogImage overrides site.ogImage for og:image and twitter:image', () => {
        const config: SSGConfig = { ...SITE, site: { ...SITE.site, ogImage: 'https://example.com/site.png' } };
        const html = gen({ ogImage: 'https://example.com/page.png' }, config);
        expect(html).toContain('<meta property="og:image" content="https://example.com/page.png">');
        expect(html).toContain('<meta name="twitter:image" content="https://example.com/page.png">');
        expect(html).not.toContain('site.png');
    });

    it('a page-only ogImage flips twitter:card to summary_large_image', () => {
        const html = gen({ ogImage: 'https://example.com/page.png' });
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    });

    it('meta.ogType overrides the default website type', () => {
        const html = gen({ ogType: 'article' });
        expect(html).toContain('<meta property="og:type" content="article">');
        expect(gen({})).toContain('<meta property="og:type" content="website">');
    });

    it('emits og:image:alt from meta.ogImageAlt or site.ogImageAlt, only with an image', () => {
        const config: SSGConfig = {
            ...SITE,
            site: { ...SITE.site, ogImage: 'https://example.com/site.png', ogImageAlt: 'Site alt' },
        };
        expect(gen({}, config)).toContain('<meta property="og:image:alt" content="Site alt">');
        expect(gen({ ogImageAlt: 'Page alt' }, config)).toContain('<meta property="og:image:alt" content="Page alt">');
        expect(gen({ ogImageAlt: 'No image, no alt' })).not.toContain('og:image:alt');
    });
});

describe('generateHeadTags — og:site_name / og:locale (#206)', () => {
    it('emits og:site_name from the site title even when the page overrides the title', () => {
        const html = gen({ title: 'Page Title' });
        expect(html).toContain('<meta property="og:site_name" content="My Site">');
        expect(html).toContain('<meta property="og:title" content="Page Title">');
    });

    it('emits og:locale in underscore form', () => {
        const config: SSGConfig = { ...SITE, site: { ...SITE.site, lang: 'en-US' } };
        expect(gen({}, config)).toContain('<meta property="og:locale" content="en_US">');
    });

    it('emits a bare language code as-is and nothing without site.lang', () => {
        const config: SSGConfig = { ...SITE, site: { ...SITE.site, lang: 'en' } };
        expect(gen({}, config)).toContain('<meta property="og:locale" content="en">');
        expect(gen({})).not.toContain('og:locale');
    });
});

describe('generateHeadTags — autoJsonLd (#206)', () => {
    const AUTO: SSGConfig = { ...SITE, autoJsonLd: true };

    function jsonLdBlocks(html: string): Record<string, unknown>[] {
        return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) =>
            JSON.parse(m[1].replace(/\u003c/g, '<'))
        );
    }

    it('is off by default', () => {
        expect(gen({ title: 'Guide' })).not.toContain('application/ld+json');
    });

    it('emits a BreadcrumbList with absolute URLs and humanized names', () => {
        const html = generateHeadTags(
            { path: '/docs/getting-started', route: { meta: { title: 'Getting Started Guide' } } },
            AUTO
        );
        const crumbs = jsonLdBlocks(html).find((b) => b['@type'] === 'BreadcrumbList') as any;
        expect(crumbs).toBeDefined();
        expect(crumbs.itemListElement).toEqual([
            { '@type': 'ListItem', position: 1, name: 'My Site', item: 'https://example.com/' },
            { '@type': 'ListItem', position: 2, name: 'Docs', item: 'https://example.com/docs/' },
            {
                '@type': 'ListItem',
                position: 3,
                name: 'Getting Started Guide',
                item: 'https://example.com/docs/getting-started/',
            },
        ]);
    });

    it('skips breadcrumbs on the root page and without site.url', () => {
        const rootHtml = generateHeadTags({ path: '/', route: { meta: {} } }, AUTO);
        expect(jsonLdBlocks(rootHtml).find((b) => b['@type'] === 'BreadcrumbList')).toBeUndefined();

        const noUrl: SSGConfig = { ...AUTO, site: { title: 'My Site' } };
        const html = generateHeadTags({ path: '/docs/x', route: { meta: {} } }, noUrl);
        expect(jsonLdBlocks(html).find((b) => b['@type'] === 'BreadcrumbList')).toBeUndefined();
    });

    it('emits a TechArticle with only the fields that exist', () => {
        const html = gen({ title: 'Guide', description: 'A guide', date: new Date('2026-01-15T00:00:00Z') }, AUTO);
        const article = jsonLdBlocks(html).find((b) => b['@type'] === 'TechArticle') as any;
        expect(article).toMatchObject({
            headline: 'Guide',
            description: 'A guide',
            url: 'https://example.com/guide/',
            datePublished: '2026-01-15T00:00:00.000Z',
            dateModified: '2026-01-15T00:00:00.000Z',
        });
    });

    it('honors the article type option and breadcrumbs opt-out', () => {
        const config: SSGConfig = { ...SITE, autoJsonLd: { breadcrumbs: false, article: 'WebPage' } };
        const blocks = jsonLdBlocks(gen({ title: 'Guide' }, config));
        expect(blocks.find((b) => b['@type'] === 'BreadcrumbList')).toBeUndefined();
        expect(blocks.find((b) => b['@type'] === 'WebPage')).toBeDefined();
    });

    it('meta.autoJsonLd: false opts the page out', () => {
        expect(gen({ title: 'Guide', autoJsonLd: false }, AUTO)).not.toContain('application/ld+json');
    });

    it('skips auto objects whose @type a hand-written entry already covers, keeping order auto → site → page', () => {
        const config: SSGConfig = {
            ...AUTO,
            site: { ...AUTO.site, jsonLd: { '@type': 'Organization', name: 'Org' } },
        };
        const blocks = jsonLdBlocks(
            gen({ title: 'Guide', jsonLd: { '@type': 'TechArticle', headline: 'Hand-written' } }, config)
        );
        const articles = blocks.filter((b) => b['@type'] === 'TechArticle');
        expect(articles).toHaveLength(1);
        expect((articles[0] as any).headline).toBe('Hand-written');
        expect(blocks.map((b) => b['@type'])).toEqual(['BreadcrumbList', 'Organization', 'TechArticle']);
    });
});
