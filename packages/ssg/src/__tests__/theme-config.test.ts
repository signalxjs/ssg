/**
 * Theme API v2 (signalxjs/ssg#60, scoped): themes can contribute markdown
 * plugins, head tags, CSS, and a default layout; site config (incl. new
 * nav/logo/repo branding fields) reaches layouts; section ordering is
 * configurable instead of hardcoding SignalX category names in core.
 */

import { describe, it, expect } from 'vitest';
import { applyThemeConfig } from '../theme';
import { generateLayoutsModule } from '../layouts/virtual';
import { generateNavigation } from '../routing/navigation';
import type { SSGConfig, SSGRoute, ThemeModule } from '../types';

const themePlugin = () => {};
const userPlugin = () => {};

const THEME: ThemeModule = {
    layouts: {},
    config: {
        defaultLayout: 'themed',
        markdown: { remarkPlugins: [themePlugin] },
        head: [{ tag: 'meta', attrs: { name: 'theme-name', content: 'test-theme' } }],
        css: ['@test/theme/styles.css'],
    },
};

describe('applyThemeConfig (#60)', () => {
    it('prepends theme css to clientImports (site CSS can override)', () => {
        const config = applyThemeConfig({ clientImports: ['./mine.css'] }, THEME);
        expect(config.clientImports).toEqual(['@test/theme/styles.css', './mine.css']);
    });

    it('merges theme markdown plugins before user plugins', () => {
        const config = applyThemeConfig({ markdown: { remarkPlugins: [userPlugin] } }, THEME);
        expect(config.markdown?.remarkPlugins).toEqual([themePlugin, userPlugin]);
    });

    it('prepends theme head tags to site.head', () => {
        const config = applyThemeConfig(
            { site: { head: [{ tag: 'meta', attrs: { name: 'mine', content: 'x' } }] } },
            THEME
        );
        expect(config.site?.head?.[0].attrs?.name).toBe('theme-name');
        expect(config.site?.head?.[1].attrs?.name).toBe('mine');
    });

    it("uses the theme's defaultLayout when the site doesn't set one", () => {
        expect(applyThemeConfig({}, THEME).defaultLayout).toBe('themed');
        expect(applyThemeConfig({ defaultLayout: 'default' }, THEME).defaultLayout).toBe('themed');
        expect(applyThemeConfig({ defaultLayout: 'custom' }, THEME).defaultLayout).toBe('custom');
    });

    it('is a no-op for themes without config', () => {
        const config: SSGConfig = { site: { title: 'X' } };
        expect(applyThemeConfig(config, { layouts: {} })).toEqual(config);
    });
});

describe('site config reaches layouts (#60)', () => {
    it('the generated layouts module embeds site config and passes it to layouts', () => {
        const code = generateLayoutsModule([], {
            defaultLayout: 'default',
            site: { title: 'My Site', nav: [{ title: 'Docs', href: '/docs' }], repo: 'https://github.com/x/y' },
        });
        expect(code).toContain('"title":"My Site"');
        expect(code).toContain('"repo":"https://github.com/x/y"');
        expect(code).toContain('site: __site');
    });
});

describe('configurable section ordering (#60)', () => {
    const routes: SSGRoute[] = [
        { path: '/docs/a', file: '/p/a.mdx', name: 'a', meta: { title: 'A', category: 'Zeta' } },
        { path: '/docs/b', file: '/p/b.mdx', name: 'b', meta: { title: 'B', category: 'Alpha' } },
    ];

    it('honors navigation.sectionOrder over the built-in defaults', () => {
        const nav = generateNavigation(routes, '/docs', 'never', false, { Zeta: 1, Alpha: 2 });
        expect(nav.sidebar.map((s) => s.title)).toEqual(['Zeta', 'Alpha']);
    });

    it('falls back to built-in ordering without a custom map', () => {
        const nav = generateNavigation(routes, '/docs', 'never', false);
        // Neither title is in the built-in map → both default to 50 → stable order
        expect(nav.sidebar.map((s) => s.title).sort()).toEqual(['Alpha', 'Zeta']);
    });
});
