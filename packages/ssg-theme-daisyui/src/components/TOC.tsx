/**
 * Table of Contents Component
 *
 * Auto-generated table of contents from page headings.
 * Watches for route changes to update headings when navigating.
 */

import { component, watch, onUnmounted } from 'sigx';
import { useRoute } from '@sigx/router';
import type { PageMeta } from '@sigx/ssg';

export interface TOCItem {
    id: string;
    text: string;
    level: number;
}

export interface TOCProps {
    /**
     * Current page meta — `meta.toc: false` hides the TOC, and
     * `meta.toc.minLevel`/`maxLevel` override the heading range (#65).
     */
    meta?: PageMeta;
    /** Lowest heading level collected. @default 2 */
    minLevel?: number;
    /** Highest heading level collected. @default 3 */
    maxLevel?: number;
}

/**
 * Text of a heading element, excluding the appended autolink anchor —
 * plain `textContent` would render every TOC item as "My Heading#" (#55).
 */
export function extractHeadingText(heading: Element): string {
    const clone = heading.cloneNode(true) as Element;
    clone.querySelectorAll('.heading-anchor, .heading-anchor-icon').forEach((el) => el.remove());
    return (clone.textContent ?? '').trim();
}

/**
 * Collect TOC items from rendered headings within `[minLevel, maxLevel]`,
 * skipping `data-toc-ignore` ones (#65). Ensures every collected heading
 * carries an id so the TOC links resolve.
 */
export function collectTocItems(root: Element, minLevel: number, maxLevel: number): TOCItem[] {
    const levels: string[] = [];
    for (let l = Math.max(1, minLevel); l <= Math.min(6, maxLevel); l++) levels.push(`h${l}`);
    if (levels.length === 0) return [];

    const items: TOCItem[] = [];
    root.querySelectorAll(levels.join(', ')).forEach((heading) => {
        if (heading.hasAttribute('data-toc-ignore')) return;
        const text = extractHeadingText(heading);
        const id = heading.id || text.toLowerCase().replace(/\s+/g, '-');
        if (!heading.id && id) heading.id = id;
        if (!text) return;
        items.push({ id, text, level: parseInt(heading.tagName[1]) });
    });
    return items;
}

export default component<TOCProps>(({ props, signal, onMounted }) => {
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

        // Per-page opt-out (#65): no collection, no observers — a true no-op.
        if (props.meta?.toc === false) {
            state.items = [];
            return;
        }

        // Extract headings from the page
        const article = document.querySelector('article');
        if (!article) {
            state.items = [];
            return;
        }

        // Per-page meta wins over props over defaults (#65).
        const tocMeta = props.meta?.toc;
        const metaLevels = typeof tocMeta === 'object' && tocMeta !== null ? tocMeta : undefined;
        const minLevel = metaLevels?.minLevel ?? props.minLevel ?? 2;
        const maxLevel = metaLevels?.maxLevel ?? props.maxLevel ?? 3;
        const items = collectTocItems(article, minLevel, maxLevel);

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

        items.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) currentObserver!.observe(el);
        });
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
        // Per-page opt-out: `toc: false` in frontmatter (#65).
        if (props.meta?.toc === false || state.items.length === 0) {
            return null;
        }

        // Indent relative to the shallowest collected heading, so custom
        // minLevel never yields negative padding or phantom nesting.
        const baseLevel = Math.min(...state.items.map((item) => item.level));

        return (
            <nav class="toc">
                <h4 class="text-sm font-semibold mb-4 text-base-content/70">
                    On this page
                </h4>
                <ul class="space-y-2 text-sm">
                    {state.items.map((item) => (
                        <li
                            style={{ paddingLeft: `${(item.level - baseLevel) * 12}px` }}
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
