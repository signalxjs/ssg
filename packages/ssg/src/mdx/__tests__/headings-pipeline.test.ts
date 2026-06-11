/**
 * Regression coverage for signalxjs/ssg#55 (heading extraction):
 *
 * The exported `headings` were computed by a SECOND plain-remark parse (no
 * GFM, no MDX), while the document renders through the MDX+GFM pipeline —
 * any heading whose text differs between the two parsers (MDX expressions,
 * JSX) got an id that doesn't exist in the rendered HTML, so TOC anchors
 * pointed nowhere. Headings must come from the same pipeline that renders.
 */

import { describe, it, expect } from 'vitest';
import { mdxPlugin } from '../plugin';
import type { TocHeading } from '../../types';

async function transform(code: string, id = '/site/src/pages/test.mdx') {
    const plugin: any = mdxPlugin({});
    await plugin.configResolved({ command: 'build' });
    return plugin.transform(code, id);
}

function exportedHeadings(code: string): TocHeading[] {
    const match = code.match(/export const headings = (\[.*?\]);/s);
    expect(match).not.toBeNull();
    return JSON.parse(match![1]);
}

function renderedIds(code: string): string[] {
    return [...code.matchAll(/\bid: "([^"]+)"/g)].map((m) => m[1]);
}

describe('exported headings match the rendered document (#55)', () => {
    it('a heading containing an MDX expression exports the rendered id', async () => {
        const result = await transform('## Count {40 + 2}\n\nbody\n');
        const ids = renderedIds(result.code);
        const headings = exportedHeadings(result.code);

        expect(headings).toHaveLength(1);
        expect(ids).toContain(headings[0].id);
    });

    it('every exported heading id exists in the rendered output', async () => {
        const result = await transform(
            '## Plain\n\n## With `code`\n\n### Count {1 + 1}\n\nbody\n'
        );
        const ids = renderedIds(result.code);
        for (const heading of exportedHeadings(result.code)) {
            expect(ids).toContain(heading.id);
        }
    });

    it('heading text does not include the appended autolink anchor', async () => {
        const result = await transform('## Hello world\n\nbody\n');
        const [heading] = exportedHeadings(result.code);
        expect(heading.text).toBe('Hello world');
        expect(heading.text).not.toContain('#');
    });

    it('respects toc min/max levels from the resolved config', async () => {
        const plugin: any = mdxPlugin({ ssgConfig: { toc: { minLevel: 2, maxLevel: 2 } } });
        await plugin.configResolved({ command: 'build' });
        const result = await plugin.transform('## Keep\n\n### Drop\n\nbody\n', '/site/src/pages/t.mdx');
        const headings = exportedHeadings(result.code);
        expect(headings.map((h) => h.text)).toEqual(['Keep']);
    });
});
