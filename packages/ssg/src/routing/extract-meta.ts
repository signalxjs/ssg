/**
 * Static extraction of `export const meta` from .tsx/.jsx page sources (#205)
 *
 * The scanner runs in plain Node before any bundling, so a page module cannot
 * be imported here (the same constraint getStaticPaths has — see
 * collect-paths.ts). Instead the meta object literal is extracted statically:
 * esbuild strips the type syntax, a brace matcher slices the literal out, and
 * the slice is evaluated in isolation. Meta that references imports or local
 * bindings is not statically analyzable — it extracts as `null` (the pre-#205
 * behavior) with a warning; the SSR bundle's runtime meta stays authoritative
 * either way (see the routeMetas merge in build.ts).
 */

import { transformSync } from 'esbuild';
import type { PageMeta } from '../types';
import { normalizeFrontmatter } from '../mdx/frontmatter';

/**
 * Result of extracting meta from a page source
 */
export interface ExtractedMeta {
    /** Extracted meta, or null when absent or not statically analyzable */
    meta: PageMeta | null;

    /** Human-readable reason when extraction was skipped or lossy */
    warning?: string;
}

/** Sentinel for values sanitize() cannot keep */
const DROP = Symbol('drop');

const META_EXPORT = /export\s+const\s+meta\b/;

/**
 * Extract `export const meta = {...}` from a .tsx/.jsx source
 */
export function extractTsxMeta(source: string, filePath: string): ExtractedMeta {
    if (!META_EXPORT.test(source)) return { meta: null };

    let js: string;
    try {
        js = transformSync(source, {
            loader: filePath.endsWith('.jsx') ? 'jsx' : 'tsx',
            jsx: 'preserve',
            format: 'esm',
        }).code;
    } catch {
        return { meta: null, warning: `${filePath}: could not parse source for meta extraction` };
    }

    // esbuild rewrites `export const meta = …` to `const meta = …` plus a
    // trailing `export { meta }` — match the declaration, not the export.
    const match = js.match(/(?:^|[\n;])\s*(?:export\s+)?const\s+meta\s*=\s*/);
    if (!match || match.index === undefined) return { meta: null };

    const start = match.index + match[0].length;
    const notAnalyzable = (reason: string): ExtractedMeta => ({
        meta: null,
        warning:
            `${filePath}: export const meta is not statically analyzable (${reason}); ` +
            `build-time head tags, sitemap, drafts and llms handling use defaults for this page`,
    });

    if (js[start] !== '{') return notAnalyzable('not an object literal');

    const literal = sliceObjectLiteral(js, start);
    if (!literal) return notAnalyzable('unterminated object literal');

    let value: unknown;
    try {
        value = new Function(`"use strict"; return (${literal});`)();
    } catch (err) {
        return notAnalyzable(err instanceof Error ? err.message : String(err));
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return notAnalyzable('not an object literal');
    }

    const dropped: string[] = [];
    const sanitized = sanitize(value, dropped, '') as Record<string, unknown>;
    const meta = normalizeFrontmatter(sanitized);

    if (dropped.length > 0) {
        return {
            meta,
            warning: `${filePath}: dropped non-serializable meta value(s): ${dropped.join(', ')}`,
        };
    }
    return { meta };
}

/**
 * Slice a balanced `{...}` object literal starting at `start` (which must
 * point at the opening brace), skipping braces inside strings, template
 * literals (including nested `${}` expressions) and comments.
 */
function sliceObjectLiteral(src: string, start: number): string | null {
    let depth = 0;
    let i = start;

    while (i < src.length) {
        const ch = src[i];
        if (ch === '{') {
            depth++;
            i++;
        } else if (ch === '}') {
            depth--;
            i++;
            if (depth === 0) return src.slice(start, i);
        } else if (ch === "'" || ch === '"') {
            i = skipString(src, i, ch);
        } else if (ch === '`') {
            i = skipTemplate(src, i);
        } else if (ch === '/' && src[i + 1] === '/') {
            const nl = src.indexOf('\n', i);
            if (nl === -1) return null;
            i = nl + 1;
        } else if (ch === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            if (end === -1) return null;
            i = end + 2;
        } else {
            i++;
        }
        if (i < 0) return null;
    }
    return null;
}

/** Skip a single- or double-quoted string; returns the index after the closing quote (or -1) */
function skipString(src: string, i: number, quote: string): number {
    i++; // opening quote
    while (i < src.length) {
        if (src[i] === '\\') i += 2;
        else if (src[i] === quote) return i + 1;
        else i++;
    }
    return -1;
}

/** Skip a template literal, including nested `${}` expressions; returns the index after the closing backtick (or -1) */
function skipTemplate(src: string, i: number): number {
    i++; // opening backtick
    while (i < src.length) {
        if (src[i] === '\\') {
            i += 2;
        } else if (src[i] === '`') {
            return i + 1;
        } else if (src[i] === '$' && src[i + 1] === '{') {
            i = skipTemplateExpr(src, i + 2);
            if (i < 0) return -1;
        } else {
            i++;
        }
    }
    return -1;
}

/** Skip a `${...}` expression body (past the opening `${`); returns the index after the closing `}` (or -1) */
function skipTemplateExpr(src: string, i: number): number {
    let depth = 1;
    while (i < src.length) {
        const ch = src[i];
        if (ch === '{') {
            depth++;
            i++;
        } else if (ch === '}') {
            depth--;
            i++;
            if (depth === 0) return i;
        } else if (ch === "'" || ch === '"') {
            i = skipString(src, i, ch);
            if (i < 0) return -1;
        } else if (ch === '`') {
            i = skipTemplate(src, i);
            if (i < 0) return -1;
        } else {
            i++;
        }
    }
    return -1;
}

/**
 * Deep-copy keeping only plain data (strings, numbers, booleans, null, Dates,
 * plain objects, arrays). Anything else — functions, symbols, class
 * instances — is dropped and its key path recorded.
 */
function sanitize(value: unknown, dropped: string[], keyPath: string): unknown {
    if (value === null) return null;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return value;
    if (value instanceof Date) return value;

    if (Array.isArray(value)) {
        const out: unknown[] = [];
        for (let idx = 0; idx < value.length; idx++) {
            const item = sanitize(value[idx], dropped, `${keyPath}[${idx}]`);
            if (item === DROP) dropped.push(`${keyPath}[${idx}]`);
            else out.push(item);
        }
        return out;
    }

    if (type === 'object' && isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            const path = keyPath ? `${keyPath}.${key}` : key;
            const item = sanitize(val, dropped, path);
            if (item === DROP) dropped.push(path);
            else out[key] = item;
        }
        return out;
    }

    return DROP;
}

function isPlainObject(value: unknown): boolean {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
