import { component } from 'sigx';
import { useRoute } from '@sigx/router';

const NAV = [
    { title: 'Home', href: '/' },
    { title: 'Guide', href: '/guide' },
    { title: 'Docs', href: '/docs/getting-started' },
    { title: 'Blog', href: '/blog' },
];

/** Trailing-slash-insensitive comparison (built sites serve `/about/`). */
function isActive(routePath: string, href: string): boolean {
    const norm = (p: string) => (p !== '/' ? p.replace(/\/+$/, '') : '/');
    const current = norm(routePath);
    const target = norm(href);
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
                    <a href={item.href} aria-current={isActive(route.path, item.href) ? 'page' : undefined}>
                        {item.title}
                    </a>
                ))}
            </nav>
        </header>
    );
});
