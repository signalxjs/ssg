/**
 * Regression coverage for signalxjs/ssg#55 (H1 title fallback):
 * `extractTitleFromContent` matched `^#` lines inside fenced code blocks,
 * so a bash comment in a fence before the first real H1 became the title.
 */

import { describe, it, expect } from 'vitest';
import { extractTitleFromContent } from '../frontmatter';

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
