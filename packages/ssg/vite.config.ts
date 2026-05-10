import { defineLibConfig } from '@sigx/vite/lib';

const externalDeps = [
    'sigx',
    /@sigx\/.*/,
    /^node:/,
    'fs', 'fs/promises', 'path', 'url',
    'vite', 'esbuild',
    'shiki', 'unified', 'gray-matter', 'fast-glob',
    /^remark-.*/, /^rehype-.*/, /^hast-.*/, /^unist-.*/,
    '@mdx-js/rollup',
    '@tailwindcss/vite',
    'tailwindcss'
];

// Library entries - for import usage
// CLI is built separately with esbuild (scripts/build-cli.ts)
// due to Vite 8/Rolldown tree-shaking bug with side-effect-only entries
export default defineLibConfig({
    entry: {
        'index': 'src/index.ts',
        'build': 'src/build.ts',
        'dev': 'src/dev.ts',
        'client': 'src/client.ts',
        'plugin': 'src/plugin.ts',
        'vite/plugin': 'src/vite/plugin.ts'
    },
    external: externalDeps,
    platform: 'node'
});

