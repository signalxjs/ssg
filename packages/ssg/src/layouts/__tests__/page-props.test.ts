/**
 * Regression coverage for signalxjs/ssg#73: route params and getStaticPaths
 * props never reached page components — the generated LayoutRouter rendered
 * every page as `PageComponent({})`, and the server entry dropped the render
 * context, so the documented `props.params.slug` pattern SSR'd to an error.
 */

import { describe, it, expect } from 'vitest';
import { generateLayoutsModule } from '../virtual';
import { generateServerEntry, generateClientEntry } from '../../vite/virtual-entries';

const CODE = generateLayoutsModule([], { defaultLayout: 'default' });

describe('generated LayoutRouter — page props (#73)', () => {
    it('passes route params (and registered static props) to page components', () => {
        expect(CODE).not.toContain('PageComponent({})');
        expect(CODE).not.toContain('rawComponent({})');
        expect(CODE).toContain('params: route.params');
    });

    it('exposes a per-path static-props registry', () => {
        expect(CODE).toContain('export function setPageProps(');
        // Lookup must be trailing-slash-insensitive (served URLs may differ
        // from build-time route paths by a trailing slash).
        expect(CODE).toMatch(/replace\(.*\/\+?\$.*\)|normalizePropsPath/);
        // Robust to URLs carrying query/hash, and a null-prototype registry.
        expect(CODE).toContain("split(/[?#]/)");
        expect(CODE).toContain('Object.create(null)');
    });

    it('route params win over a static-props params key', () => {
        // Spread order: static props first, params last.
        expect(CODE).toContain('...getPageProps(routePath), params: route.params');
    });
});

describe('generated server entry — forwards render context (#73)', () => {
    const code = generateServerEntry({ base: '/' });

    it('registers getStaticPaths props for the rendered path', () => {
        expect(code).toContain('setPageProps(');
        expect(code).toContain('context');
    });
});

describe('generated client entry — hydrates with embedded props (#73)', () => {
    const code = generateClientEntry({ base: '/' }, {
        useVirtualClient: true,
        useVirtualServer: true,
        useVirtualHtml: true,
    });

    it('reads the embedded __SSG_PROPS__ payload before hydrating', () => {
        expect(code).toContain('__SSG_PROPS__');
        expect(code).toContain('setPageProps(');
    });
});

describe('pagePropsScript — embedded hydration payload (#73)', () => {
    it('emits a script registering path + props', async () => {
        const { pagePropsScript } = await import('../../head');
        const script = pagePropsScript('/blog/first-post', { featured: true });
        expect(script).toContain('window.__SSG_PROPS__');
        expect(script).toContain('"path":"/blog/first-post"');
        expect(script).toContain('"featured":true');
    });

    it('returns an empty string when there are no props', async () => {
        const { pagePropsScript } = await import('../../head');
        expect(pagePropsScript('/x', undefined)).toBe('');
        expect(pagePropsScript('/x', {})).toBe('');
    });

    it('escapes < so props cannot break out of the script tag', async () => {
        const { pagePropsScript } = await import('../../head');
        const script = pagePropsScript('/x', { html: '</script><script>alert(1)' });
        expect(script).not.toContain('</script><script>alert');
        expect(script).toContain('\\u003c/script');
    });
});
