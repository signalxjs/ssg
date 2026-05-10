/**
 * @sigx/ssr-islands/server
 *
 * Server-side island utilities.
 */

export { createTrackingSignal, serializeSignalState } from './render-component';
export {
    escapeJsonForScript,
    generateIslandDataScript
} from './render-islands';

// Re-export shared types from server-renderer
export type { SSRSignalFn } from '@sigx/server-renderer';
export { generateSignalKey } from '@sigx/server-renderer';
