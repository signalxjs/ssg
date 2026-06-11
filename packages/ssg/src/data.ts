/**
 * Build-time data loaders (signalxjs/ssg#59).
 *
 * `data: { versions: async () => fetchVersions() }` in the config runs each
 * loader once per build (shared across the client and SSR Vite builds via a
 * process-wide cache) and exposes the results via `virtual:ssg-data`:
 *
 *     import data from 'virtual:ssg-data';
 *     data.versions
 *
 * Named exports also exist per key, but the shipped ambient types cover the
 * default export only — augment `virtual:ssg-data` in your site for typed
 * named imports. Values must be JSON-serializable — they are baked into the
 * bundle, for the server render and the client alike.
 */

import type { DataLoaders } from './types';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Run every loader and validate the results. Throws with the loader's key. */
export async function runDataLoaders(loaders: DataLoaders): Promise<Record<string, unknown>> {
    const values: Record<string, unknown> = {};

    for (const [key, loader] of Object.entries(loaders)) {
        if (!IDENTIFIER.test(key)) {
            throw new Error(
                `data: key "${key}" is not a valid identifier — it becomes a named export of virtual:ssg-data.`
            );
        }
        let value: unknown;
        try {
            value = await loader();
        } catch (err) {
            throw new Error(
                `data: loader "${key}" failed: ${err instanceof Error ? err.message : String(err)}`,
                { cause: err }
            );
        }
        let serialized: string | undefined;
        try {
            serialized = JSON.stringify(value);
        } catch (err) {
            throw new Error(
                `data: value for "${key}" is not JSON-serializable (it is baked into the bundle): ` +
                    `${err instanceof Error ? err.message : String(err)}`
            );
        }
        // JSON.stringify returns undefined (without throwing) for undefined
        // and functions — also not valid JSON.
        if (serialized === undefined) {
            throw new Error(
                `data: loader "${key}" returned ${typeof value} — values must be JSON-serializable.`
            );
        }
        values[key] = value;
    }

    return values;
}

/** ESM source for `virtual:ssg-data`: one named export per key + default. */
export function generateDataModule(values: Record<string, unknown>): string {
    const lines = Object.entries(values).map(
        ([key, value]) => `export const ${key} = ${JSON.stringify(value)};`
    );
    const defaults = Object.keys(values)
        .map((key) => `    ${key},`)
        .join('\n');
    return `${lines.join('\n')}\n\nexport default {\n${defaults}\n};\n`;
}

// ---------------------------------------------------------------------------
// Process-wide cache: a production build runs TWO Vite builds (client + SSR)
// with separate plugin instances. Loaders must run once and bake identical
// values into both bundles — non-deterministic loaders (timestamps, fetches)
// would otherwise cause SSR/client mismatches.
// ---------------------------------------------------------------------------

const dataCacheByRoot = new Map<string, Promise<Record<string, unknown>>>();

/** Run the loaders once per project root, shared across plugin instances. */
export function loadDataOnce(root: string, loaders: DataLoaders): Promise<Record<string, unknown>> {
    let cached = dataCacheByRoot.get(root);
    if (!cached) {
        cached = runDataLoaders(loaders);
        // A failed run must not poison every later build in this process.
        cached.catch(() => dataCacheByRoot.delete(root));
        dataCacheByRoot.set(root, cached);
    }
    return cached;
}

/** Drop the cached values for a root (dev: the config file changed). */
export function clearDataCache(root: string): void {
    dataCacheByRoot.delete(root);
}
