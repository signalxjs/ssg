/**
 * Per-page markdown rendition for the llms outputs (signalxjs/ssg#176):
 * frontmatter → minimal url/title/description header, MDX syntax stripped
 * by a fence-aware line scanner that must NEVER touch fence contents —
 * docs pages are full of `import { signal } from 'sigx'` inside fences.
 */

import { describe, it, expect } from 'vitest';
import { renderPageMarkdown } from '../llms-md';

const OPTS = { url: 'https://example.com/docs/guide/', sourceFile: '/site/src/pages/docs/guide.mdx' };
const MD_OPTS = { url: 'https://example.com/docs/guide/', sourceFile: '/site/src/pages/docs/guide.md' };

function render(source: string, options: Partial<typeof OPTS> & { meta?: Record<string, unknown> } = {}) {
    return renderPageMarkdown(source, { ...OPTS, ...options });
}

describe('renderPageMarkdown — header block', () => {
    it('replaces frontmatter with the url/title/description header', () => {
        const out = render('---\ntitle: Guide\ndescription: How to\nlayout: docs\n---\n\n# Guide\n');
        expect(out).toBe(
            '---\nurl: https://example.com/docs/guide/\ntitle: Guide\ndescription: How to\n---\n\n# Guide\n'
        );
        expect(out).not.toContain('layout:');
    });

    it('omits missing title/description lines', () => {
        const out = render('No frontmatter at all.\n');
        expect(out).toBe('---\nurl: https://example.com/docs/guide/\n---\n\nNo frontmatter at all.\n');
    });

    it('prefers the route meta over the raw frontmatter', () => {
        const out = render('---\ntitle: Raw\n---\n\nBody\n', { meta: { title: 'From Meta' } });
        expect(out).toContain('title: From Meta');
    });

    it('quotes values YAML would misread', () => {
        const out = render('---\ntitle: "Guide: the sequel"\n---\n\nBody\n');
        expect(out).toContain('title: "Guide: the sequel"');
        // URLs stay bare — `:` without a following space is not a mapping.
        expect(out).toContain('url: https://example.com/docs/guide/');
    });
});

describe('renderPageMarkdown — ESM stripping (mdx)', () => {
    it('drops a single-line import', () => {
        const out = render("import { Demo } from '../components/Demo';\n\nProse stays.\n");
        expect(out).not.toContain('import');
        expect(out).toContain('Prose stays.');
    });

    it('drops multi-line imports/exports up to the blank line (MDX ESM grammar)', () => {
        const out = render(
            'import {\n    A,\n    B,\n} from "./widgets";\n\nexport const meta = {\n    x: 1,\n};\n\nProse stays.\n'
        );
        expect(out).not.toContain('widgets');
        expect(out).not.toContain('x: 1');
        expect(out).toContain('Prose stays.');
    });

    it('never touches an import inside a code fence', () => {
        const fence = "```ts\nimport { defineSSGConfig } from '@sigx/ssg';\n\nexport default defineSSGConfig({});\n```";
        const out = render(`Intro.\n\n${fence}\n\nOutro.\n`);
        expect(out).toContain("import { defineSSGConfig } from '@sigx/ssg';");
        expect(out).toContain('export default defineSSGConfig({});');
    });

    it('leaves prose starting with "import" alone in plain .md sources', () => {
        const out = renderPageMarkdown('import maps are a browser feature.\n', MD_OPTS);
        expect(out).toContain('import maps are a browser feature.');
    });
});

describe('renderPageMarkdown — fences', () => {
    it('normalizes fence meta to the bare language', () => {
        const out = render('```tsx code console live\nconst x = 1;\n```\n');
        expect(out).toContain('```tsx\nconst x = 1;\n```');
    });

    it('leaves a bare fence bare', () => {
        const out = render('```\nplain\n```\n');
        expect(out).toContain('```\nplain\n```');
    });

    it('does not close a ~~~ fence with ```', () => {
        const out = render('~~~js\ncode\n```\nstill code\n~~~\nAfter.\n');
        expect(out).toContain('still code');
        expect(out).toContain('After.');
    });

    it('accepts a longer closing marker, not a shorter one', () => {
        const out = render('````md\n```\ninner fence\n```\n````\nAfter.\n');
        expect(out).toContain('inner fence');
        expect(out).toContain('After.');
    });

    it('keeps everything after an unclosed fence verbatim', () => {
        const out = render('```ts\nimport real from "code";\n<Component />\n');
        expect(out).toContain('import real from "code";');
        expect(out).toContain('<Component />');
    });

    it('handles CRLF sources — fences still open/close, output is LF-only', () => {
        // `.`/`$` in JS regexes treat `\r` as a line terminator, so an
        // unnormalized CRLF source made every fence-open miss and the
        // fence CONTENTS get scanned as MDX (the ts fence below would
        // lose its import line).
        const out = render(
            '---\r\ntitle: G\r\n---\r\n\r\n```ts\r\nimport real from "code";\r\n```\r\n\r\nAfter.\r\n'
        );
        expect(out).toContain('```ts\nimport real from "code";\n```');
        expect(out).toContain('After.');
        expect(out).not.toContain('\r');
    });

    it('leaves indented code blocks untouched', () => {
        const out = render('Text.\n\n    import indented from "code";\n\nMore.\n');
        expect(out).toContain('    import indented from "code";');
    });
});

describe('renderPageMarkdown — JSX stripping (mdx)', () => {
    it('drops self-closing capitalized tags', () => {
        const out = render('Before.\n\n<Demo prop="x" />\n\nAfter.\n');
        expect(out).not.toContain('<Demo');
        expect(out).toContain('Before.');
        expect(out).toContain('After.');
    });

    it('drops multi-line self-closing tags (attributes spanning lines)', () => {
        const out = render('Before.\n\n<Demo\n    prop={42}\n    other="y"\n/>\n\nAfter.\n');
        expect(out).not.toContain('<Demo');
        expect(out).not.toContain('prop=');
        expect(out).toContain('After.');
    });

    it('drops paired capitalized tags but keeps their children', () => {
        const out = render('<Note type="warning">\n\nThe children survive.\n\n</Note>\n');
        expect(out).not.toContain('<Note');
        expect(out).not.toContain('</Note>');
        expect(out).toContain('The children survive.');
    });

    it('handles nested same-name tags', () => {
        const out = render('<Box>\nouter\n<Box>\ninner\n</Box>\nouter again\n</Box>\nAfter.\n');
        expect(out).not.toContain('<Box>');
        expect(out).not.toContain('</Box>');
        for (const text of ['outer', 'inner', 'outer again', 'After.']) {
            expect(out).toContain(text);
        }
    });

    it('strips same-line pairs keeping the inner text', () => {
        const out = render('Status: <Badge variant="new">beta</Badge> today.\n');
        expect(out).toContain('Status: beta today.');
    });

    it('leaves JSX inside inline code spans alone', () => {
        const out = render('Drop `<Demo />` into any page.\n');
        expect(out).toContain('Drop `<Demo />` into any page.');
    });

    it('lets lowercase inline HTML pass through', () => {
        const out = render('<div class="callout">\nplain html\n</div>\n');
        expect(out).toContain('<div class="callout">');
        expect(out).toContain('</div>');
    });
});

describe('renderPageMarkdown — expressions (mdx)', () => {
    it('substitutes {frontmatter.x} inline and whole-line', () => {
        const out = render(
            '---\ntitle: Guide\nversion: 2.1.0\n---\n\nCurrent version: {frontmatter.version}.\n\n{frontmatter.title}\n'
        );
        expect(out).toContain('Current version: 2.1.0.');
        expect(out).toContain('Guide');
    });

    it('drops single-line and multi-line JSX comments', () => {
        const out = render('{/* hidden note */}\n\n{/*\nmulti-line\nhidden\n*/}\n\nVisible.\n');
        expect(out).not.toContain('hidden');
        expect(out).toContain('Visible.');
    });

    it('drops whole-line expressions, single and multi-line', () => {
        const out = render('{new Date().getFullYear()}\n\n{items.map((i) => (\n  <li>{i}</li>\n))}\n\nVisible.\n');
        expect(out).not.toContain('getFullYear');
        expect(out).not.toContain('items.map');
        expect(out).toContain('Visible.');
    });

    it('keeps inline braces mid-prose', () => {
        const out = render('Use `{ deep: true }` for nested watching.\n');
        expect(out).toContain('Use `{ deep: true }` for nested watching.');
    });

    it('keeps a prose line with multiple separate brace groups', () => {
        const out = render('{a} between {b}\n');
        expect(out).toContain('{a} between {b}');
    });
});

describe('renderPageMarkdown — tidy', () => {
    it('collapses the blank runs left by dropped blocks', () => {
        const out = render("import x from 'y';\n\n\n\n<Demo />\n\n\n\nProse.\n");
        expect(out).not.toMatch(/\n{3,}/);
        expect(out).toContain('Prose.');
    });

    it('ends with exactly one trailing newline', () => {
        const out = render('Body.');
        expect(out.endsWith('.\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });
});
