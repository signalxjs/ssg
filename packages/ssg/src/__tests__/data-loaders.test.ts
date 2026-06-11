/**
 * Build-time data loaders (signalxjs/ssg#59): `config.data` runs loaders
 * once per build and exposes the results via `virtual:ssg-data`. Evidence
 * of need: the docs site's fetch-versions.mjs + daily cron exist solely to
 * fetch npm versions into a generated TS module before build.
 */

import { describe, it, expect, vi } from 'vitest';
import { runDataLoaders, generateDataModule } from '../data';

describe('runDataLoaders (#59)', () => {
    it('runs every loader (sync or async) and returns the values', async () => {
        const values = await runDataLoaders({
            versions: async () => ({ sigx: '0.4.5' }),
            year: () => 2026,
        });
        expect(values).toEqual({ versions: { sigx: '0.4.5' }, year: 2026 });
    });

    it('rejects keys that are not valid identifiers', async () => {
        await expect(runDataLoaders({ 'not-valid': () => 1 })).rejects.toThrow(/not-valid/);
    });

    it('rejects values that do not survive JSON serialization', async () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        await expect(runDataLoaders({ bad: () => circular })).rejects.toThrow(/bad/);
    });

    it('names the failing loader when one throws', async () => {
        await expect(
            runDataLoaders({
                ok: () => 1,
                broken: () => {
                    throw new Error('upstream down');
                },
            })
        ).rejects.toThrow(/broken.*upstream down/s);
    });

    it('runs loaders only when called (no caching surprises here)', async () => {
        const loader = vi.fn(() => 1);
        await runDataLoaders({ n: loader });
        expect(loader).toHaveBeenCalledTimes(1);
    });
});

describe('generateDataModule (#59)', () => {
    it('emits one named export per key plus a default export', () => {
        const code = generateDataModule({ versions: { sigx: '0.4.5' }, year: 2026 });
        expect(code).toContain('export const versions = ');
        expect(code).toContain('export const year = 2026;');
        expect(code).toContain('export default');
        // The module must be valid ESM that round-trips the values.
        expect(code).toContain('"sigx":"0.4.5"');
    });
});
