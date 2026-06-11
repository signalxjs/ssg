import { component } from 'sigx';
import { useRoute } from '@sigx/router';
import type { LayoutProps, LayoutSlots } from '@sigx/ssg';
// Auto-generated from page frontmatter (`category`, `order`) per collection —
// no nav config is written by hand anywhere in this example.
import { getSidebar, detectCollection } from 'virtual:ssg-navigation';
import SiteHeader from '../components/SiteHeader';

function samePath(a: string, b: string): boolean {
    const norm = (p: string) => (p !== '/' ? p.replace(/\/+$/, '') : '/');
    return norm(a) === norm(b);
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
                                <ul>
                                    {section.items.map((item) => (
                                        <li>
                                            <a
                                                href={item.href ?? '#'}
                                                aria-current={item.href && samePath(route.path, item.href) ? 'page' : undefined}
                                            >
                                                {item.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </aside>
                    <main>{slots.default()}</main>
                </div>
                <footer>Built with @sigx/ssg</footer>
            </div>
        );
    };
});
