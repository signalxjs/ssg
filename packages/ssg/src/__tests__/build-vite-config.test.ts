/**
 * Regression coverage for signalxjs/ssg#49: `base` from ssg.config.ts must be
 * passed to both Vite builds. Inheritance was one-way (Vite → SSG), so a base
 * set only in ssg.config.ts produced a router/sitemap with the prefix but
 * built HTML whose asset URLs lacked it — broken site on subpath deploys.
 */

import { describe, it, expect } from 'vitest';
import { createViteBuildConfigs, SSR_EXTERNAL_PACKAGES } from '../build';
import type { SSGConfig } from '../types';

const CONFIG: SSGConfig = {
    base: '/docs/',
    outDir: '/site/dist',
};

describe('createViteBuildConfigs — base propagation (#49)', () => {
    const { client, ssr } = createViteBuildConfigs(CONFIG, '/site', '/site/index.html', '/site/.ssg-temp-entry-server.tsx', false);

    it('passes base to the client build', () => {
        expect(client.base).toBe('/docs/');
        expect(client.build?.rollupOptions?.input).toBe('/site/index.html');
        expect(client.build?.outDir).toBe('/site/dist');
    });

    it('passes base to the SSR build', () => {
        expect(ssr.base).toBe('/docs/');
        expect(ssr.build?.ssr).toBe(true);
        expect(ssr.build?.rollupOptions?.input).toBe('/site/.ssg-temp-entry-server.tsx');
    });

    it('defaults base to / when unset', () => {
        const configs = createViteBuildConfigs({ outDir: '/site/dist' }, '/site', '/site/index.html', '/site/entry.tsx', false);
        expect(configs.client.base).toBe('/');
        expect(configs.ssr.base).toBe('/');
    });

    it('normalizes a blank base to /, consistent with the build inheritance logic', () => {
        const configs = createViteBuildConfigs({ base: '', outDir: '/site/dist' }, '/site', '/site/index.html', '/site/entry.tsx', false);
        expect(configs.client.base).toBe('/');
        expect(configs.ssr.base).toBe('/');
    });
});

/**
 * signalxjs/ssg#224: the SSR bundle is import()ed by the build process, which
 * already holds node_modules' sigx runtime (Vite loaded the project's
 * vite.config, and @sigx/vite with it). @sigx/vite marks the whole @sigx
 * family noExternal for a standalone `vite build --ssr`, so unless the SSG
 * build lists the runtime in `ssr.external` the bundle inlines a second copy
 * of @sigx/reactivity — and core 1.0's duplicate-copy guard throws at import.
 */
describe('createViteBuildConfigs — the SSR bundle externalizes the sigx runtime (#224)', () => {
    const { client, ssr } = createViteBuildConfigs({ outDir: '/site/dist' }, '/site', '/site/index.html', '/site/entry.tsx', false);

    it('lists every core runtime package and @sigx/router as ssr.external', () => {
        const external = ssr.ssr?.external;
        expect(Array.isArray(external)).toBe(true);
        for (const pkg of ['sigx', '@sigx/reactivity', '@sigx/runtime-core', '@sigx/runtime-dom', '@sigx/server-renderer', '@sigx/router']) {
            expect(external).toContain(pkg);
        }
        expect(external).toEqual([...SSR_EXTERNAL_PACKAGES]);
    });

    it('leaves the client build alone — the browser bundle has no node_modules to fall back to', () => {
        expect(client.ssr).toBeUndefined();
    });
});
