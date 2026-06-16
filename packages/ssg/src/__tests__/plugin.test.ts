import { describe, expect, it } from 'vitest';
import { command, parseArgs } from '@sigx/args';
import plugin from '../plugin.js';

/**
 * Regression test for #158: the CLI plugin must declare command args as
 * `@sigx/args` fluent builders, not plain `ArgDef` objects. `@sigx/cli` >= 0.4
 * normalizes each arg by reading its internal `~def`; plain objects have none,
 * so `command().args()` (eager validation) crashes the whole CLI with
 * `Cannot use 'in' operator to search for 'required' in undefined`.
 */
describe('cli plugin args', () => {
    it('exposes dev, build and preview commands', () => {
        expect(Object.keys(plugin.commands).sort()).toEqual(['build', 'dev', 'preview']);
    });

    for (const [name, cmd] of Object.entries(plugin.commands)) {
        describe(`command "${name}"`, () => {
            it('declares args as @sigx/args fluent builders (carries ~def)', () => {
                const args = cmd.args ?? {};
                for (const [argName, builder] of Object.entries(args)) {
                    expect(
                        builder != null && typeof builder === 'object' && '~def' in builder,
                        `arg "${argName}" must be an a.* builder, got ${JSON.stringify(builder)}`,
                    ).toBe(true);
                }
            });

            it('normalizes through @sigx/cli >= 0.4 without throwing', () => {
                // Mirrors @sigx/cli's wrapPluginCommand: command(name).args(cmd.args).
                // Eager validation throws here if args lack a `~def`.
                expect(() => command(name).args(cmd.args ?? {}).run(() => {})).not.toThrow();
            });
        });
    }

    it('parses build flags with correct coercion', () => {
        const { args } = parseArgs(
            ['--config', 'custom.ts', '--verbose', '--drafts', '--concurrency', '8'],
            plugin.commands.build!.args!,
        );
        expect(args.config).toBe('custom.ts');
        expect(args.verbose).toBe(true);
        expect(args.drafts).toBe(true);
        expect(args.concurrency).toBe('8');
    });

    it('parses dev flags with correct coercion', () => {
        const { args } = parseArgs(['--port', '4000', '--host', '--open'], plugin.commands.dev!.args!);
        expect(args.port).toBe('4000');
        expect(args.host).toBe(true);
        expect(args.open).toBe(true);
    });
});
