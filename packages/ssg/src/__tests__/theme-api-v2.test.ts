/**
 * Theme API v2 remainder (signalxjs/ssg#60) + #65 plumbing:
 * - meta.sourceFile reaches layouts (edit-this-page links need it)
 * - themes contribute build hooks, composed with the site's
 * - a default 404.html is emitted when the site has none
 */

import { describe, it, expect, vi } from 'vitest';
import { generateRoutesModule } from '../routing/virtual';
import { applyThemeConfig } from '../theme';
import { generateDefault404 } from '../default-404';
import type { SSGRoute, ThemeConfig } from '../types';

describe('meta.sourceFile in the routes module (#60/#65)', () => {
    const routes: SSGRoute[] = [
        { path: '/guide', file: '/proj/src/pages/guide.mdx', name: 'guide', meta: { title: 'G' } },
    ];

    it('embeds the root-relative posix source path into every route meta', () => {
        const code = generateRoutesModule(routes, {}, '/proj');
        expect(code).toContain(`sourceFile: "src/pages/guide.mdx"`);
    });

    it('omits sourceFile when root is unknown', () => {
        const code = generateRoutesModule(routes, {});
        expect(code).not.toContain('sourceFile');
    });
});

describe('theme-contributed build hooks (#60)', () => {
    it('composes transformHtml: theme first, then site', async () => {
        const theme: ThemeConfig = {
            hooks: { transformHtml: (html) => html + '<!--theme-->' },
        };
        const config = applyThemeConfig(
            { hooks: { transformHtml: (html) => html + '<!--site-->' } },
            { config: theme }
        );
        const out = await config.hooks!.transformHtml!('<x>', { path: '/', meta: {} } as never);
        expect(out).toBe('<x><!--theme--><!--site-->');
    });

    it('runs both onPageRendered and postBuild hooks', async () => {
        const themeSpy = vi.fn();
        const siteSpy = vi.fn();
        const config = applyThemeConfig(
            { hooks: { onPageRendered: siteSpy, postBuild: siteSpy } },
            { config: { hooks: { onPageRendered: themeSpy, postBuild: themeSpy } } }
        );
        await config.hooks!.onPageRendered!({ path: '/' } as never);
        await config.hooks!.postBuild!({ pages: [], warnings: [] } as never, {} as never);
        expect(themeSpy).toHaveBeenCalledTimes(2);
        expect(siteSpy).toHaveBeenCalledTimes(2);
    });

    it('keeps theme-only hooks working when the site has none', async () => {
        const themeSpy = vi.fn();
        const config = applyThemeConfig({}, { config: { hooks: { onPageRendered: themeSpy } } });
        await config.hooks!.onPageRendered!({ path: '/' } as never);
        expect(themeSpy).toHaveBeenCalledTimes(1);
    });
});

describe('default 404 page (#65)', () => {
    it('renders a minimal page with the site title and a home link', () => {
        const html = generateDefault404({ site: { title: 'My Site' }, base: '/' });
        expect(html).toContain('404');
        expect(html).toContain('My Site');
        expect(html).toContain('href="/"');
        expect(html).toContain('<!DOCTYPE html>');
    });

    it('respects the base for the home link and escapes the title', () => {
        const html = generateDefault404({ site: { title: '<X&Y>' }, base: '/sub/' });
        expect(html).toContain('href="/sub/"');
        expect(html).not.toContain('<X&Y>');
        expect(html).toContain('&lt;X&amp;Y&gt;');
    });
});
