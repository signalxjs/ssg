/**
 * Prev/next page links (signalxjs/ssg#65) — neighbors in the sidebar's
 * reading order, from `virtual:ssg-navigation` for the current collection.
 */

import { component } from 'sigx';
import { useRoute } from '@sigx/router';
import { prevNextLinks } from '../lib/prev-next.js';
import type { NavSection } from './Sidebar.js';

let generatedNavigation: Record<string, { sidebar: NavSection[] }> = {};
let detectCollection: (path: string) => string | undefined = () => undefined;

try {
    // @ts-ignore - Virtual module exists only inside an ssg build
    const navModule = await import('virtual:ssg-navigation');
    generatedNavigation = navModule.navigation || {};
    detectCollection = navModule.detectCollection || (() => undefined);
} catch {
    /* outside an ssg build — renders nothing */
}

export default component(() => {
    const route = useRoute();

    return () => {
        const collection = detectCollection(route.path);
        const sections = collection ? (generatedNavigation[collection]?.sidebar ?? []) : [];
        const { prev, next } = prevNextLinks(sections, route.path);
        if (!prev && !next) return null;

        return (
            <nav class="prev-next flex justify-between gap-4 mt-12 pt-6 border-t border-base-300" aria-label="Pagination">
                {prev ? (
                    <a href={prev.href} class="btn btn-ghost justify-start text-left flex-col items-start h-auto py-2">
                        <span class="text-xs opacity-60">← Previous</span>
                        <span class="font-medium">{prev.title}</span>
                    </a>
                ) : (
                    <span />
                )}
                {next ? (
                    <a href={next.href} class="btn btn-ghost justify-end text-right flex-col items-end h-auto py-2">
                        <span class="text-xs opacity-60">Next →</span>
                        <span class="font-medium">{next.title}</span>
                    </a>
                ) : (
                    <span />
                )}
            </nav>
        );
    };
});
