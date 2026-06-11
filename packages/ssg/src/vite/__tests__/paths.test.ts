/**
 * Regression coverage for signalxjs/ssg#54 — Windows path handling:
 *
 * 1. Watcher/HMR prefix checks compared `path.resolve` results (backslashes
 *    on Windows) against Vite's posix-normalized file paths with bare
 *    `startsWith` — never true on Windows, and missing a path-boundary check
 *    everywhere (`src/pages-archive/x` matched `src/pages`).
 * 2. The production HTML template interpolated a raw `path.join` result into
 *    `<script src>` — backslash URLs on Windows.
 */

import { describe, it, expect } from 'vitest';
import { isInsideDir } from '../paths';
import { generateProductionHtmlTemplate } from '../virtual-entries';

describe('isInsideDir (#54)', () => {
    it('matches posix paths inside a dir', () => {
        expect(isInsideDir('/proj/src/pages/a.mdx', '/proj/src/pages')).toBe(true);
        expect(isInsideDir('/proj/src/pages/deep/b.tsx', '/proj/src/pages')).toBe(true);
    });

    it('matches Windows-native file or dir paths', () => {
        expect(isInsideDir('C:\\proj\\src\\pages\\a.mdx', 'C:\\proj\\src\\pages')).toBe(true);
        // Vite hands posix-normalized paths while path.resolve produced backslashes
        expect(isInsideDir('C:/proj/src/pages/a.mdx', 'C:\\proj\\src\\pages')).toBe(true);
    });

    it('enforces a path boundary (no sibling-prefix matches)', () => {
        expect(isInsideDir('/proj/src/pages-archive/a.mdx', '/proj/src/pages')).toBe(false);
        expect(isInsideDir('C:/proj/src/pagesX/a.mdx', 'C:\\proj\\src\\pages')).toBe(false);
    });

    it('does not match the dir itself or unrelated paths', () => {
        expect(isInsideDir('/proj/src/pages', '/proj/src/pages')).toBe(false);
        expect(isInsideDir('/elsewhere/a.mdx', '/proj/src/pages')).toBe(false);
    });
});

describe('generateProductionHtmlTemplate — script src (#54)', () => {
    it('normalizes Windows entry paths to forward slashes', () => {
        const html = generateProductionHtmlTemplate({}, 'C:\\proj\\.ssg-temp-entry-client.tsx');
        expect(html).toContain('src="C:/proj/.ssg-temp-entry-client.tsx"');
        expect(html).not.toContain('\\');
    });

    it('leaves posix entry paths untouched', () => {
        const html = generateProductionHtmlTemplate({}, '/proj/.ssg-temp-entry-client.tsx');
        expect(html).toContain('src="/proj/.ssg-temp-entry-client.tsx"');
    });
});
