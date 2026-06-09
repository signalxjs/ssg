import { describe, it, expect } from 'vitest';
import { type Pm, PMS, parse, render, translate } from '../package-manager';

describe('parse', () => {
    it('returns null for non-package-manager lines', () => {
        expect(parse('sigx prebuild')).toBeNull();
        expect(parse('cd my-app')).toBeNull();
        expect(parse('')).toBeNull();
        expect(parse('   ')).toBeNull();
        expect(parse('# just a comment')).toBeNull();
    });

    it('parses add commands across managers', () => {
        expect(parse('pnpm add foo')).toMatchObject({ action: 'add', args: 'foo' });
        expect(parse('yarn add foo')).toMatchObject({ action: 'add', args: 'foo' });
        expect(parse('bun add foo')).toMatchObject({ action: 'add', args: 'foo' });
        // npm `install <pkg>` is an add; bare `install` installs all.
        expect(parse('npm install foo')).toMatchObject({ action: 'add', args: 'foo' });
        expect(parse('npm i foo')).toMatchObject({ action: 'add', args: 'foo' });
        expect(parse('npm install')).toMatchObject({ action: 'install', args: '' });
    });

    it('extracts dev and global flags', () => {
        expect(parse('npm install -D foo')).toMatchObject({ action: 'add', dev: true, args: 'foo' });
        expect(parse('pnpm add --save-dev foo')).toMatchObject({ dev: true, args: 'foo' });
        expect(parse('npm install -g foo')).toMatchObject({ global: true, args: 'foo' });
        expect(parse('yarn global add foo')).toMatchObject({ action: 'add', global: true, args: 'foo' });
    });

    it('maps one-off executors to dlx', () => {
        expect(parse('npx create-app')).toMatchObject({ action: 'dlx', args: 'create-app' });
        expect(parse('bunx create-app')).toMatchObject({ action: 'dlx', args: 'create-app' });
        expect(parse('pnpm dlx create-app')).toMatchObject({ action: 'dlx', args: 'create-app' });
        expect(parse('bun x create-app')).toMatchObject({ action: 'dlx', args: 'create-app' });
    });

    it('parses remove / create / run', () => {
        expect(parse('npm uninstall foo')).toMatchObject({ action: 'remove', args: 'foo' });
        expect(parse('pnpm remove foo')).toMatchObject({ action: 'remove', args: 'foo' });
        expect(parse('npm create vite')).toMatchObject({ action: 'create', args: 'vite' });
        expect(parse('pnpm run build')).toMatchObject({ action: 'run', args: 'build' });
    });

    it('preserves a trailing comment verbatim', () => {
        expect(parse('pnpm add foo # needed')).toMatchObject({ args: 'foo', comment: ' # needed' });
    });
});

describe('render', () => {
    it('renders npm install for adds, add for everyone else', () => {
        const add = parse('pnpm add foo')!;
        expect(render(add, 'npm')).toBe('npm install foo');
        expect(render(add, 'pnpm')).toBe('pnpm add foo');
        expect(render(add, 'yarn')).toBe('yarn add foo');
        expect(render(add, 'bun')).toBe('bun add foo');
    });

    it('renders dev/global flags and yarn classic global', () => {
        expect(render(parse('npm install -D foo')!, 'pnpm')).toBe('pnpm add -D foo');
        expect(render(parse('npm install -g foo')!, 'yarn')).toBe('yarn global add foo');
        expect(render(parse('yarn global add foo')!, 'npm')).toBe('npm install -g foo');
    });

    it('renders dlx per manager', () => {
        const dlx = parse('pnpm dlx create-app')!;
        expect(render(dlx, 'npm')).toBe('npx create-app');
        expect(render(dlx, 'bun')).toBe('bunx create-app');
        expect(render(dlx, 'yarn')).toBe('yarn dlx create-app');
        expect(render(dlx, 'pnpm')).toBe('pnpm dlx create-app');
    });

    it('keeps the comment', () => {
        expect(render(parse('pnpm add foo # needed')!, 'npm')).toBe('npm install foo # needed');
    });
});

describe('round-trip — parse is total over render output', () => {
    const lines = [
        'pnpm add @sigx/lynx-video',
        'npm install -D typescript',
        'npm install -g @sigx/cli',
        'yarn global add @sigx/cli',
        'pnpm remove foo',
        'pnpm dlx create-sigx',
        'npm install',
    ];

    for (const line of lines) {
        it(`re-parses every rendered variant of "${line}"`, () => {
            const base = parse(line);
            expect(base).not.toBeNull();
            for (const target of PMS) {
                const rendered = render(base!, target);
                // Every rendered command must parse back to the same shape, so
                // flipping managers repeatedly never degrades the command.
                const reparsed = parse(rendered);
                expect(reparsed, `"${rendered}" should re-parse`).not.toBeNull();
                expect(render(reparsed!, target)).toBe(rendered);
            }
        });
    }
});

describe('translate', () => {
    it('rewrites recognized commands and passes others through', () => {
        expect(translate('pnpm add foo', 'npm' as Pm)).toBe('npm install foo');
        expect(translate('sigx prebuild', 'npm' as Pm)).toBe('sigx prebuild');
    });
});
