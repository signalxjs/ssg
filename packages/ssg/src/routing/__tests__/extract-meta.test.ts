/**
 * Tests for static extraction of `export const meta` from .tsx/.jsx pages
 * (signalxjs/ssg#205): TSX pages' meta was invisible at scan time, so head
 * tags, drafts, sitemap overrides, llms and search all fell back to site
 * defaults while the rendered page (which reads `Module.meta` at runtime)
 * showed the real values.
 */

import { describe, it, expect } from 'vitest';
import { extractTsxMeta } from '../extract-meta';

describe('extractTsxMeta', () => {
    it('extracts a simple object literal', () => {
        const { meta, warning } = extractTsxMeta(
            `export const meta = { title: 'CLI', description: 'Scaffold projects', layout: 'package' };\n` +
                `export default function Page() { return <div />; }\n`,
            'page.tsx'
        );
        expect(warning).toBeUndefined();
        expect(meta).toMatchObject({ title: 'CLI', description: 'Scaffold projects', layout: 'package' });
    });

    it('extracts booleans, numbers, null, arrays and nested objects', () => {
        const { meta } = extractTsxMeta(
            `export const meta = {
                title: 'X',
                draft: true,
                order: 3,
                priority: 0.8,
                nothing: null,
                tags: ['a', 'b'],
                head: [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }],
                jsonLd: { '@type': 'TechArticle', headline: 'X' },
            };`,
            'page.tsx'
        );
        expect(meta).toMatchObject({
            title: 'X',
            draft: true,
            order: 3,
            priority: 0.8,
            nothing: null,
            tags: ['a', 'b'],
            head: [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }],
            jsonLd: { '@type': 'TechArticle', headline: 'X' },
        });
    });

    it('handles a type annotation, `as const` and `satisfies`', () => {
        for (const decl of [
            `export const meta: PageMeta = { title: 'T' };`,
            `export const meta = { title: 'T' } as const;`,
            `export const meta = { title: 'T' } satisfies PageMeta;`,
        ]) {
            const { meta, warning } = extractTsxMeta(`${decl}\nexport default () => <div />;`, 'page.tsx');
            expect(warning).toBeUndefined();
            expect(meta).toMatchObject({ title: 'T' });
        }
    });

    it('handles comments and braces inside string values', () => {
        const { meta } = extractTsxMeta(
            `export const meta = {
                // the title
                title: 'A { brace } title',
                /* multi
                   line */
                description: "uses {curly} braces and 'quotes'",
            };`,
            'page.tsx'
        );
        expect(meta).toMatchObject({
            title: 'A { brace } title',
            description: "uses {curly} braces and 'quotes'",
        });
    });

    it('handles comments containing braces inside template interpolations', () => {
        // esbuild strips comments in practice, but the scanner must not rely
        // on that — a stray brace in a comment must not desync the matcher.
        const { meta, warning } = extractTsxMeta(
            'export const meta = { title: `T${/* } */ "x"}`, description: "d" };',
            'page.tsx'
        );
        expect(warning).toBeUndefined();
        expect(meta).toMatchObject({ title: 'Tx', description: 'd' });
    });

    it('handles template literals without interpolation of outer scope', () => {
        const { meta } = extractTsxMeta(
            'export const meta = { title: `Tem${"pl"}ate`, description: `has a } brace` };',
            'page.tsx'
        );
        expect(meta).toMatchObject({ title: 'Template', description: 'has a } brace' });
    });

    it('normalizes date strings like MDX frontmatter does', () => {
        const { meta } = extractTsxMeta(`export const meta = { title: 'T', date: '2026-01-15' };`, 'page.tsx');
        expect(meta?.date).toBeInstanceOf(Date);
        expect((meta as { date: Date }).date.toISOString()).toContain('2026-01-15');
    });

    it('returns null without warning when there is no meta export', () => {
        const { meta, warning } = extractTsxMeta(`export default function Page() { return <div />; }`, 'page.tsx');
        expect(meta).toBeNull();
        expect(warning).toBeUndefined();
    });

    it('returns null with a warning when meta references imports or locals', () => {
        const { meta, warning } = extractTsxMeta(
            `import { SITE } from '../lib/site';\nexport const meta = { title: SITE.name };`,
            'src/pages/page.tsx'
        );
        expect(meta).toBeNull();
        expect(warning).toContain('src/pages/page.tsx');
    });

    it('drops function values with a warning but keeps the rest', () => {
        const { meta, warning } = extractTsxMeta(
            `export const meta = { title: 'T', render: () => 'x' };`,
            'page.tsx'
        );
        expect(meta).toMatchObject({ title: 'T' });
        expect(meta && 'render' in meta).toBe(false);
        expect(warning).toContain('render');
    });

    it('works for .jsx sources', () => {
        const { meta } = extractTsxMeta(
            `export const meta = { title: 'JSX Page' };\nexport default () => <div />;`,
            'page.jsx'
        );
        expect(meta).toMatchObject({ title: 'JSX Page' });
    });

    it('bails out on files without an export const meta match cheaply', () => {
        const { meta } = extractTsxMeta(`const meta = { title: 'not exported' };`, 'page.tsx');
        expect(meta).toBeNull();
    });
});
