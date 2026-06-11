/**
 * Regression coverage for signalxjs/ssg#49: `base` from ssg.config.ts must be
 * passed to both Vite builds. Inheritance was one-way (Vite → SSG), so a base
 * set only in ssg.config.ts produced a router/sitemap with the prefix but
 * built HTML whose asset URLs lacked it — broken site on subpath deploys.
 */

import { describe, it, expect } from 'vitest';
import { createViteBuildConfigs } from '../build';
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
});
