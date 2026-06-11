import { component } from 'sigx';
import { useRoute } from '@sigx/router';

// `match` is the section prefix used for active highlighting; it can be
// broader than `href` (the Docs item links to one page but owns /docs/*).
const NAV = [
    { title: 'Home', href: '/', match: '/' },
    { title: 'Guide', href: '/guide', match: '/guide' },
    { title: 'Docs', href: '/docs/getting-started', match: '/docs' },
    { title: 'Blog', href: '/blog', match: '/blog' },
];

/** Trailing-slash-insensitive section match (built sites serve `/about/`). */
function isActive(routePath: string, match: string): boolean {
    const norm = (p: string) => (p !== '/' ? p.replace(/\/+$/, '') : '/');
    const current = norm(routePath);
    const target = norm(match);
    if (target === '/') return current === '/';
    return current === target || current.startsWith(target + '/');
}

export default component(() => {
    const route = useRoute();
    return () => (
        <header class="site-header">
            <a href="/" class="site-brand">SSG Basic Example</a>
            <nav aria-label="Main">
                {NAV.map((item) => (
                    <a href={item.href} aria-current={isActive(route.path, item.match) ? 'page' : undefined}>
                        {item.title}
                    </a>
                ))}
            </nav>
        </header>
    );
});
