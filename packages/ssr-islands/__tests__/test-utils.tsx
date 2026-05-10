/**
 * Shared test utilities for ssr-islands tests
 * Re-exports common utilities from server-renderer's test-utils
 * and adds islands-specific helpers.
 */

export {
    createIslandDataScript,
    createStateScript,
    cleanupScripts,
    createSSRContainer,
    cleanupContainer,
    ssrElement,
    ssrComponentMarkers,
    ssrIslandMarkers,
    ssrTextSeparator,
    escapeHtml,
    nextTick,
    waitForIdle,
    createVNode,
    createTextVNode,
    createFragmentVNode,
    TestCounter,
    TestCounterWithProps,
    TestAsyncCounter,
    TestText,
    TestWrapper,
    TestMountHook,
    TestButton,
} from '../../server-renderer/__tests__/test-utils';

export type { SSRSignalFn } from '../../server-renderer/__tests__/test-utils';

/**
 * Parse island data from rendered HTML (__SIGX_ISLANDS__ script)
 */
export function parseIslandData(html: string): Record<string, any> {
    const match = html.match(/<script[^>]*id="__SIGX_ISLANDS__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return {};
    return JSON.parse(match[1]);
}
