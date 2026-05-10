/**
 * Component rendering utilities for SSR islands
 *
 * Signal tracking and state serialization for hydration state transfer.
 * Moved from @sigx/server-renderer — this is island-specific overhead.
 */

import {
    signal
} from 'sigx';
import { generateSignalKey } from '@sigx/server-renderer';
import type { SSRSignalFn } from '@sigx/server-renderer';

// Re-export for backward compatibility
export type { SSRSignalFn };

/**
 * Creates a tracking signal function that records signal names and values.
 * Used during async setup to capture state for client hydration.
 * Supports both primitive and object signals.
 */
export function createTrackingSignal(signalMap: Map<string, any>): SSRSignalFn {
    let signalIndex = 0;
    let hasWarnedPositional = false;

    return function trackingSignal(initial: any, name?: string): any {
        // Generate a stable key for this signal
        const key = generateSignalKey(name, signalIndex++);

        // Dev warning: positional keys are fragile in islands
        if (process.env.NODE_ENV !== 'production' && !name && !hasWarnedPositional) {
            hasWarnedPositional = true;
            console.warn(
                `[SSR Islands] Signal created without a name in an island component. ` +
                `Positional keys ("${key}") are fragile — if signal declaration order differs ` +
                `between server and client, state restoration will silently restore wrong values. ` +
                `Consider using named signals: signal(${JSON.stringify(initial)}, "mySignalName")`
            );
        }

        // Create the real signal (handles both primitives and objects)
        const sig = signal(initial as any);

        // Capture initial value
        signalMap.set(key, initial);

        // Create a proxy that tracks writes to .value
        const proxy = new Proxy(sig as any, {
            get(target: any, prop: string | symbol) {
                if (prop === 'value') {
                    return target.value;
                }
                return target[prop];
            },
            set(target: any, prop: string | symbol, newValue: any) {
                if (prop === 'value') {
                    target.value = newValue;
                    signalMap.set(key, newValue);
                    return true;
                }
                target[prop] = newValue;
                return true;
            }
        });

        return proxy;
    } as SSRSignalFn;
}

/**
 * Serialize captured signal state for client hydration
 */
export function serializeSignalState(signalMap: Map<string, any>): Record<string, any> | undefined {
    if (signalMap.size === 0) return undefined;

    const state: Record<string, any> = {};
    for (const [key, value] of signalMap) {
        try {
            // Test if serializable
            JSON.stringify(value);
            state[key] = value;
        } catch {
            // Skip non-serializable values
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`SSR: Signal "${key}" has non-serializable value, skipping`);
            }
        }
    }
    return Object.keys(state).length > 0 ? state : undefined;
}
