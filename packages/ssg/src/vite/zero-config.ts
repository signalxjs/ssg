/**
 * Zero-config Vite assembly, shared by the dev server and the build (#52).
 *
 * Dev already injected @sigx/vite + optional Tailwind + the SSG plugins when
 * no vite.config exists; the build called vite.build with NO plugins, so the
 * virtual modules the temp entries import could never resolve — "zero-config"
 * dev and build had different requirements.
 */

import path from 'node:path';
import fs from 'node:fs';
import { ssgPlugin } from './plugin';

const VITE_CONFIG_FILES = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.mts',
];

/** Whether the project supplies its own Vite config. */
export function hasViteConfigFile(root: string): boolean {
    return VITE_CONFIG_FILES.some((file) => fs.existsSync(path.join(root, file)));
}

/** The oxc JSX setup zero-config mode needs (Vite 8 uses oxc, not esbuild). */
export const ZERO_CONFIG_OXC = {
    jsx: {
        runtime: 'automatic',
        importSource: 'sigx',
    },
} as const;

/**
 * Assemble the zero-config plugin set: @sigx/vite (JSX), optional Tailwind,
 * and the SSG plugins. Returns fresh plugin instances on every call — plugin
 * objects hold per-build state and must not be shared between Vite builds.
 */
export async function assembleZeroConfigPlugins(configPath?: string): Promise<any[]> {
    const plugins: any[] = [];

    // Tailwind CSS, if installed (variable specifier + @vite-ignore keep
    // bundlers/vitest from trying to resolve the optional dependency)
    try {
        const tailwindSpecifier = '@tailwindcss/vite';
        const tailwind = await import(/* @vite-ignore */ tailwindSpecifier);
        plugins.push(tailwind.default());
    } catch {
        // Not installed, skip
    }

    // @sigx/vite for the SignalX JSX transform
    try {
        const sigxVite = await import('@sigx/vite');
        plugins.push(sigxVite.sigxPlugin());
    } catch {
        console.warn('⚠️  @sigx/vite not found, JSX transform may not work');
        console.warn('   Install with: npm install @sigx/vite\n');
    }

    plugins.push(...ssgPlugin({ configPath }));

    return plugins;
}
