/**
 * Regression coverage for signalxjs/ssg#55 (H1 title fallback):
 * `extractTitleFromContent` matched `^#` lines inside fenced code blocks,
 * so a bash comment in a fence before the first real H1 became the title.
 */

import { describe, it, expect } from 'vitest';
import { extractTitleFromContent, applyTitleFallback } from '../frontmatter';

describe('extractTitleFromContent (#55)', () => {
    it('extracts the first H1', () => {
        expect(extractTitleFromContent('# My Title\n\nbody')).toBe('My Title');
    });

    it('ignores # lines inside fenced code blocks', () => {
        const content = '```bash\n# not a title\necho hi\n```\n\n# Real Title\n\nbody';
        expect(extractTitleFromContent(content)).toBe('Real Title');
    });

    it('returns null when there is no H1', () => {
        expect(extractTitleFromContent('Just text\n\n## Section')).toBeNull();
    });
});

describe('applyTitleFallback (#65)', () => {
    it('backfills the title from the H1 and marks it as content-derived', () => {
        const fm: Record<string, unknown> = {};
        applyTitleFallback(fm, '# From Content\n\nbody');
        expect(fm.title).toBe('From Content');
        // Layouts skip their own <h1> for content-derived titles — the H1 is
        // already in the page body (#65 double-h1 fix).
        expect(fm.titleFromContent).toBe(true);
    });

    it('leaves an explicit frontmatter title untouched and unmarked', () => {
        const fm: Record<string, unknown> = { title: 'Explicit' };
        applyTitleFallback(fm, '# Other\n\nbody');
        expect(fm.title).toBe('Explicit');
        expect(fm.titleFromContent).toBeUndefined();
    });

    it('does nothing when there is no H1', () => {
        const fm: Record<string, unknown> = {};
        applyTitleFallback(fm, 'no heading');
        expect(fm.title).toBeUndefined();
        expect(fm.titleFromContent).toBeUndefined();
    });
});
