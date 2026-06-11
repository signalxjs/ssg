/**
 * Build-time data loaders (signalxjs/ssg#59).
 *
 * `data: { versions: async () => fetchVersions() }` in the config runs each
 * loader once per build (and once per dev-server start) and exposes the
 * results via the `virtual:ssg-data` module:
 *
 *     import data, { versions } from 'virtual:ssg-data';
 *
 * Values must be JSON-serializable — they are baked into the bundle, for
 * the server render and the client alike.
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
        try {
            JSON.stringify(value);
        } catch (err) {
            throw new Error(
                `data: value for "${key}" is not JSON-serializable (it is baked into the bundle): ` +
                    `${err instanceof Error ? err.message : String(err)}`
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
