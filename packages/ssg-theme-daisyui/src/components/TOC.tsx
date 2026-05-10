/**
 * Table of Contents Component
 *
 * Auto-generated table of contents from page headings.
 * Watches for route changes to update headings when navigating.
 */

import { component, watch, onUnmounted } from 'sigx';
import { useRoute } from '@sigx/router';

export interface TOCItem {
    id: string;
    text: string;
    level: number;
}

export interface TOCProps {
    // Future: allow passing items directly
}

export default component(({ signal, onMounted }) => {
    const route = useRoute();
    const state = signal<{ items: TOCItem[]; activeId: string | null }>({
        items: [],
        activeId: null,
    });

    // Track current observer for cleanup
    let currentObserver: IntersectionObserver | null = null;

    /**
     * Extract headings and setup observer
     * Called on mount and when route changes
     */
    function setupHeadings() {
        // Cleanup previous observer
        if (currentObserver) {
            currentObserver.disconnect();
            currentObserver = null;
        }

        // Extract headings from the page
        const article = document.querySelector('article');
        if (!article) {
            state.items = [];
            return;
        }

        const headings = article.querySelectorAll('h2, h3');
        const items: TOCItem[] = [];

        headings.forEach((heading) => {
            const id = heading.id || heading.textContent?.toLowerCase().replace(/\s+/g, '-') || '';

            // Ensure heading has an ID
            if (!heading.id && id) {
                heading.id = id;
            }

            items.push({
                id,
                text: heading.textContent || '',
                level: parseInt(heading.tagName[1]),
            });
        });

        state.items = items;

        if (items.length === 0) {
            return;
        }

        // Setup intersection observer for active heading
        currentObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        state.activeId = entry.target.id;
                        break;
                    }
                }
            },
            { rootMargin: '-100px 0px -80% 0px' }
        );

        headings.forEach((heading) => currentObserver!.observe(heading));
    }

    onMounted(() => {
        setupHeadings();
    });

    // Watch for route changes to update headings
    watch(
        () => route.path,
        () => {
            // Small delay to ensure new content is rendered
            requestAnimationFrame(() => {
                setupHeadings();
            });
        }
    );

    onUnmounted(() => {
        if (currentObserver) {
            currentObserver.disconnect();
            currentObserver = null;
        }
    });

    return () => {
        if (state.items.length === 0) {
            return null;
        }

        return (
            <nav class="toc">
                <h4 class="text-sm font-semibold mb-4 text-base-content/70">
                    On this page
                </h4>
                <ul class="space-y-2 text-sm">
                    {state.items.map((item) => (
                        <li
                            style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
                        >
                            <a
                                href={`#${item.id}`}
                                class={`
                                    block py-1 border-l-2 pl-3 transition-colors
                                    ${
                                        state.activeId === item.id
                                            ? 'border-primary text-primary font-medium'
                                            : 'border-transparent text-base-content/60 hover:text-base-content hover:border-base-300'
                                    }
                                `}
                            >
                                {item.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        );
    };
});
