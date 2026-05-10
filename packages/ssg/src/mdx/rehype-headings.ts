/**
 * Rehype plugin to extract headings from MDX/MD content
 *
 * Extracts headings (h2-h6 by default) with their IDs and text content
 * for use in table of contents generation.
 */

import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { TocHeading } from '../types';

/**
 * Options for the rehype headings plugin
 */
export interface RehypeHeadingsOptions {
    /**
     * Minimum heading level to include (1-6)
     * @default 2
     */
    minLevel?: number;

    /**
     * Maximum heading level to include (1-6)
     * @default 3
     */
    maxLevel?: number;
}

/**
 * Rehype plugin to extract headings from the document
 *
 * Stores extracted headings in `file.data.headings` for later use.
 *
 * @example
 * ```ts
 * import { rehypeExtractHeadings } from './rehype-headings';
 *
 * // Use with unified
 * unified()
 *   .use(rehypeSlug)  // First add IDs to headings
 *   .use(rehypeExtractHeadings, { minLevel: 2, maxLevel: 3 })
 * ```
 */
export function rehypeExtractHeadings(options: RehypeHeadingsOptions = {}) {
    const { minLevel = 2, maxLevel = 3 } = options;

    return (tree: any, file: any) => {
        const headings: TocHeading[] = [];

        visit(tree, 'element', (node: any) => {
            // Check if this is a heading element (h1-h6)
            const match = /^h([1-6])$/.exec(node.tagName);
            if (!match) return;

            const level = parseInt(match[1], 10);

            // Skip headings outside configured range
            if (level < minLevel || level > maxLevel) return;

            // Get the heading ID (should be set by rehype-slug)
            const id = node.properties?.id;
            if (!id) return;

            // Extract text content from the heading
            const text = toString(node).trim();
            if (!text) return;

            headings.push({ id, text, level });
        });

        // Store headings in file data for later access
        file.data = file.data || {};
        file.data.headings = headings;
    };
}

export default rehypeExtractHeadings;
