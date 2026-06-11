/**
 * Tests for the generated server entry (signalxjs/ssg#46): it must export
 * getStaticPathsForRoute so the build can resolve dynamic-route params from
 * the built SSR bundle instead of import()ing raw .tsx/.mdx sources.
 */

import { describe, it, expect } from 'vitest';
import { generateServerEntry } from '../virtual-entries';

describe('generateServerEntry — getStaticPathsForRoute (#46)', () => {
    const code = generateServerEntry({ base: '/' });

    it('exports render', () => {
        expect(code).toContain('export async function render(');
    });

    it('exports getStaticPathsForRoute resolving against the routes module', () => {
        expect(code).toContain('export async function getStaticPathsForRoute(');
        expect(code).toContain('getStaticPaths');
    });
});
