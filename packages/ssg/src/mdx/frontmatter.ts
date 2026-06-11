/**
 * Frontmatter parser
 *
 * Extracts and parses YAML frontmatter from Markdown/MDX files.
 */

import matter from 'gray-matter';
import type { PageMeta } from '../types';

/**
 * Result of parsing frontmatter
 */
export interface FrontmatterResult {
    /**
     * Parsed frontmatter data
     */
    data: PageMeta;

    /**
     * Content body without frontmatter
     */
    content: string;

    /**
     * Raw frontmatter string
     */
    raw: string;

    /**
     * Whether frontmatter was present
     */
    hasFrontmatter: boolean;
}

/**
 * Parse frontmatter from content
 */
export function parseFrontmatter(source: string): FrontmatterResult {
    const { data, content, matter: raw } = matter(source);

    return {
        data: normalizeFrontmatter(data),
        content,
        raw: raw || '',
        hasFrontmatter: !!raw,
    };
}

/**
 * Normalize frontmatter data to PageMeta
 */
function normalizeFrontmatter(data: Record<string, unknown>): PageMeta {
    const meta: PageMeta = {};

    // Standard fields
    if (typeof data.title === 'string') meta.title = data.title;
    if (typeof data.description === 'string') meta.description = data.description;
    if (typeof data.layout === 'string') meta.layout = data.layout;
    if (typeof data.draft === 'boolean') meta.draft = data.draft;

    // Date handling
    if (data.date) {
        if (data.date instanceof Date) {
            meta.date = data.date;
        } else if (typeof data.date === 'string') {
            meta.date = new Date(data.date);
        }
    }

    // Tags
    if (Array.isArray(data.tags)) {
        meta.tags = data.tags.filter((t) => typeof t === 'string');
    }

    // SSR flag
    if (typeof data.ssr === 'boolean') meta.ssr = data.ssr;

    // Copy all other fields
    for (const [key, value] of Object.entries(data)) {
        if (!(key in meta)) {
            meta[key] = value;
        }
    }

    return meta;
}

/**
 * Extract title from markdown content if not in frontmatter
 *
 * Looks for the first H1 heading. Fenced code blocks are stripped first —
 * a `# comment` line inside a fence is never a title (#55).
 */
export function extractTitleFromContent(content: string): string | null {
    const withoutFences = content
        .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '')
        // An unclosed fence swallows the rest of the document.
        .replace(/^(```|~~~)[\s\S]*$/m, '');
    const h1Match = withoutFences.match(/^#\s+(.+)$/m);
    return h1Match ? h1Match[1].trim() : null;
}

/**
 * Serialize frontmatter back to YAML string
 */
export function serializeFrontmatter(data: PageMeta): string {
    const lines: string[] = ['---'];

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;

        if (value instanceof Date) {
            lines.push(`${key}: ${value.toISOString().split('T')[0]}`);
        } else if (Array.isArray(value)) {
            lines.push(`${key}:`);
            for (const item of value) {
                lines.push(`  - ${JSON.stringify(item)}`);
            }
        } else if (typeof value === 'object' && value !== null) {
            lines.push(`${key}: ${JSON.stringify(value)}`);
        } else {
            lines.push(`${key}: ${JSON.stringify(value)}`);
        }
    }

    lines.push('---');
    return lines.join('\n');
}
