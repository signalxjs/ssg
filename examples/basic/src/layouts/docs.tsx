import { component } from 'sigx';
import { useRoute } from '@sigx/router';
import type { LayoutProps, LayoutSlots, NavItem } from '@sigx/ssg';
// Auto-generated from page frontmatter (`category`, `order`) per collection —
// no nav config is written by hand anywhere in this example.
import { getSidebar, detectCollection } from 'virtual:ssg-navigation';
import SiteHeader from '../components/SiteHeader';

function samePath(a: string, b: string): boolean {
    const norm = (p: string) => (p !== '/' ? p.replace(/\/+$/, '') : '/');
    return norm(a) === norm(b);
}

/**
 * A nav entry is either a leaf (has `href`) or a group with nested `items`
 * (e.g. from array `category` frontmatter) — render groups recursively.
 */
function renderItem(item: NavItem, currentPath: string) {
    if (item.items && item.items.length > 0) {
        return (
            <li>
                <details open>
                    <summary>{item.title}</summary>
                    <ul>{item.items.map((child) => renderItem(child, currentPath))}</ul>
                </details>
            </li>
        );
    }
    if (!item.href) return null;
    return (
        <li>
            <a href={item.href} aria-current={samePath(currentPath, item.href) ? 'page' : undefined}>
                {item.title}
            </a>
        </li>
    );
}

/**
 * Docs layout: pages under /docs get this automatically via
 * `collections.docs.layout` in ssg.config.ts — no per-page frontmatter needed.
 */
export default component<LayoutProps, unknown, LayoutSlots>(({ slots }) => {
    const route = useRoute();

    return () => {
        const collection = detectCollection(route.path) ?? 'docs';
        const sections = getSidebar(collection);

        return (
            <div class="site site-with-sidebar">
                <SiteHeader />
                <div class="docs-grid">
                    <aside class="docs-sidebar" aria-label="Docs navigation">
                        {sections.map((section) => (
                            <section>
                                {section.title ? <h4>{section.title}</h4> : null}
                                <ul>{section.items.map((item) => renderItem(item, route.path))}</ul>
                            </section>
                        ))}
                    </aside>
                    <main>{slots.default?.()}</main>
                </div>
                <footer>Built with @sigx/ssg</footer>
            </div>
        );
    };
});
