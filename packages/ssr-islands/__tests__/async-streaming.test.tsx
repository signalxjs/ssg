/**
 * End-to-end tests for async streaming hydration flow
 * Tests the full server→stream→client round-trip for async components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { component, signal } from 'sigx';
import { hydrate } from '../../server-renderer/src/client/hydrate-core';
// Side-effect import: sets up the sigx:async-ready event listener
import { hydrateLeftoverAsyncComponents } from '../src/client/hydrate-async';
import { invalidateIslandCache } from '../src/client/island-context';
import { registerComponent, getComponent } from '../src/client/registry';
import { registerClientPlugin, clearClientPlugins } from '../../server-renderer/src/client/hydrate-context';
import { islandsPlugin } from '../src/plugin';
import {
    createSSRContainer,
    cleanupContainer,
    createIslandDataScript,
    cleanupScripts,
    ssrComponentMarkers,
    nextTick
} from './test-utils';
import type { SSRSignalFn } from './test-utils';

describe('async streaming hydration', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        cleanupScripts();
        clearClientPlugins();
    });

    afterEach(() => {
        if (container) {
            cleanupContainer(container);
        }
        cleanupScripts();
        clearClientPlugins();
    });

    describe('async placeholder hydration', () => {
        it('should hydrate async component when sigx:async-ready fires', async () => {
            let hydrated = false;

            const AsyncComponent = component((ctx) => {
                hydrated = true;
                const ssrSignal = ctx.signal as SSRSignalFn;
                const data = ssrSignal('loaded', 'data');
                return () => <div class="async-content">{data.value}</div>;
            }, { name: 'AsyncComponent' });

            registerComponent('AsyncComponent', AsyncComponent);

            // Set up DOM with async placeholder
            container = createSSRContainer(
                '<div data-async-placeholder="1"><div class="async-content">loaded</div></div>'
            );

            // Set up island data (as if streaming script ran)
            createIslandDataScript({
                '1': {
                    strategy: 'load',
                    componentId: 'AsyncComponent',
                    state: { data: 'loaded' },
                    props: {}
                }
            });

            // Hydrate the main app first
            const AppComponent = component(() => {
                return () => <div id="app-root">App</div>;
            }, { name: 'App' });

            // Fire the async-ready event (simulates streaming script)
            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '1', state: { data: 'loaded' } }
            });
            document.dispatchEvent(event);
            await nextTick();

            expect(hydrated).toBe(true);
        });

        it('should skip already-hydrated async components', async () => {
            let hydrateCount = 0;

            const DuplicateComponent = component((ctx) => {
                hydrateCount++;
                return () => <span>Content</span>;
            }, { name: 'DuplicateComponent' });

            registerComponent('DuplicateComponent', DuplicateComponent);

            container = createSSRContainer(
                '<div data-async-placeholder="2" data-hydrated><span>Content</span></div>'
            );

            createIslandDataScript({
                '2': {
                    strategy: 'load',
                    componentId: 'DuplicateComponent',
                    state: {},
                    props: {}
                }
            });

            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '2' }
            });
            document.dispatchEvent(event);
            await nextTick();

            // Should not hydrate since data-hydrated is already set
            expect(hydrateCount).toBe(0);
        });

        it('should warn when placeholder not found', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            container = createSSRContainer('<div>No placeholders</div>');

            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '999' }
            });
            document.dispatchEvent(event);
            await nextTick();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Could not find placeholder')
            );
            warnSpy.mockRestore();
        });
    });

    describe('leftover async components', () => {
        it('should hydrate async placeholders that were missed during initial hydration', async () => {
            let hydrated = false;

            const LeftoverComponent = component((ctx) => {
                hydrated = true;
                const ssrSignal = ctx.signal as SSRSignalFn;
                const msg = ssrSignal('leftover', 'msg');
                return () => <span class="leftover">{msg.value}</span>;
            }, { name: 'LeftoverComponent' });

            registerComponent('LeftoverComponent', LeftoverComponent);

            // Set up a container with an async placeholder that hasn't been hydrated
            container = createSSRContainer(
                '<div data-async-placeholder="3"><span class="leftover">leftover</span></div><!--$c:3-->'
            );

            createIslandDataScript({
                '3': {
                    strategy: 'load',
                    componentId: 'LeftoverComponent',
                    state: { msg: 'leftover' },
                    props: {}
                }
            });

            // In the plugin architecture, leftover hydration is triggered explicitly
            // (or via the islands plugin's afterHydrate hook)
            hydrateLeftoverAsyncComponents(container);
            await nextTick();

            // The leftover async component should be discovered and hydrated
            expect(hydrated).toBe(true);
        });
    });

    describe('state restoration during streaming', () => {
        it('should restore server state for async components streamed after initial hydration', async () => {
            let restoredValue: any;

            const StreamedComponent = component((ctx) => {
                const ssrSignal = ctx.signal as SSRSignalFn;
                const count = ssrSignal(0, 'count');
                restoredValue = count.value;
                return () => <span class="count">{count.value}</span>;
            }, { name: 'StreamedComponent' });

            registerComponent('StreamedComponent', StreamedComponent);

            container = createSSRContainer(
                '<div data-async-placeholder="4"><span class="count">42</span></div>'
            );

            createIslandDataScript({
                '4': {
                    strategy: 'load',
                    componentId: 'StreamedComponent',
                    state: { count: 42 },
                    props: {}
                }
            });

            // Fire async-ready to simulate the streaming script
            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '4', state: { count: 42 } }
            });
            document.dispatchEvent(event);
            await nextTick();

            expect(restoredValue).toBe(42);
        });

        it('should handle async component with no state', async () => {
            let hydrated = false;

            const NoStateComponent = component((ctx) => {
                hydrated = true;
                return () => <span>No state needed</span>;
            }, { name: 'NoStateComponent' });

            registerComponent('NoStateComponent', NoStateComponent);

            container = createSSRContainer(
                '<div data-async-placeholder="5"><span>No state needed</span></div>'
            );

            createIslandDataScript({
                '5': {
                    strategy: 'load',
                    componentId: 'NoStateComponent',
                    props: {}
                }
            });

            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '5' }
            });
            document.dispatchEvent(event);
            await nextTick();

            expect(hydrated).toBe(true);
        });
    });

    describe('component registry integration', () => {
        it('should warn when unregistered component is referenced in async streaming', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            container = createSSRContainer(
                '<div data-async-placeholder="6"><span>Unknown</span></div>'
            );

            createIslandDataScript({
                '6': {
                    strategy: 'load',
                    componentId: 'NeverRegistered',
                    props: {}
                }
            });

            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '6' }
            });
            document.dispatchEvent(event);
            await nextTick();

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('could not be resolved')
            );
            errorSpy.mockRestore();
        });

        it('should auto-register components during hydration via islands plugin', async () => {
            // In the plugin architecture, auto-registration happens when the
            // islands plugin encounters a component at an async placeholder
            // during the hydration walk.
            const AutoRegComponent = component((ctx) => {
                return () => <span class="auto-reg">Auto</span>;
            }, { name: 'AutoRegComponent' });

            // Register the islands client plugin
            registerClientPlugin(islandsPlugin());

            // Use an async placeholder — the islands plugin auto-registers
            // named components found at async placeholders
            container = createSSRContainer(
                '<div data-async-placeholder="1"><span class="auto-reg">Auto</span></div><!--$c:1-->'
            );

            hydrate(
                {
                    type: AutoRegComponent,
                    props: { 'client:load': true },
                    key: null,
                    children: [],
                    dom: null
                },
                container
            );
            await nextTick();

            // The component should have been auto-registered by the islands plugin
            expect(getComponent('AutoRegComponent')).toBe(AutoRegComponent);
        });
    });

    describe('island data cache', () => {
        it('should invalidate cache between async component streams', async () => {
            // First island data
            createIslandDataScript({
                '1': {
                    strategy: 'load',
                    componentId: 'CachedComp',
                    state: { val: 'first' }
                }
            });

            // Force cache to be populated
            invalidateIslandCache();

            // Update the script with new data
            cleanupScripts();
            createIslandDataScript({
                '1': {
                    strategy: 'load',
                    componentId: 'CachedComp',
                    state: { val: 'second' }
                }
            });

            // After invalidation, should get updated data
            let restoredVal: any;

            const CachedComp = component((ctx) => {
                const ssrSignal = ctx.signal as SSRSignalFn;
                const val = ssrSignal('', 'val');
                restoredVal = val.value;
                return () => <span>{val.value}</span>;
            }, { name: 'CachedComp' });

            registerComponent('CachedComp', CachedComp);

            container = createSSRContainer(
                '<div data-async-placeholder="1"><span>second</span></div>'
            );

            const event = new CustomEvent('sigx:async-ready', {
                detail: { id: '1', state: { val: 'second' } }
            });
            document.dispatchEvent(event);
            await nextTick();

            expect(restoredVal).toBe('second');
        });
    });
});
