/**
 * Prev/next page links from the sidebar navigation (signalxjs/ssg#65). The
 * order is the flattened sidebar order — sections in order, items
 * depth-first — which matches the reading order users see.
 */

export interface NavLink {
    title: string;
    href: string;
}

interface NavTreeItem {
    title: string;
    href?: string;
    items?: NavTreeItem[];
}

interface NavTreeSection {
    title: string;
    items: NavTreeItem[];
}

function samePath(a: string, b: string): boolean {
    return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
}

/** All linkable items in reading order (sections in order, depth-first). */
export function flattenNavLinks(sections: NavTreeSection[]): NavLink[] {
    const links: NavLink[] = [];
    const walk = (items: NavTreeItem[]) => {
        for (const item of items) {
            if (item.href) links.push({ title: item.title, href: item.href });
            if (item.items?.length) walk(item.items);
        }
    };
    for (const section of sections) walk(section.items);
    return links;
}

/** The current page's neighbors in reading order (null at the ends). */
export function prevNextLinks(
    sections: NavTreeSection[],
    currentPath: string
): { prev: NavLink | null; next: NavLink | null } {
    const links = flattenNavLinks(sections);
    const index = links.findIndex((l) => samePath(l.href, currentPath));
    if (index === -1) return { prev: null, next: null };
    return {
        prev: index > 0 ? links[index - 1] : null,
        next: index < links.length - 1 ? links[index + 1] : null,
    };
}
