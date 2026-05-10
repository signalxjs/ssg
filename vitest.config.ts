import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    oxc: {
        jsx: {
            runtime: 'automatic',
            importSource: 'sigx'
        }
    },
    test: {
        environment: 'happy-dom',
        include: ['packages/**/__tests__/**/*.test.{ts,tsx}'],
        exclude: [
            '**/node_modules/**',
            // These integration tests reach into @sigx/server-renderer's
            // internals via relative paths (../../server-renderer/src/...).
            // They were workspace-internal in viewti/lynx; they only run there
            // until either server-renderer exposes more subpath exports or we
            // rewrite them against public APIs.
            'packages/ssr-islands/__tests__/**/*.test.tsx'
        ],
        globals: true,
        passWithNoTests: true,
    },
    resolve: {
        alias: {
            '@sigx/ssg': resolve(__dirname, 'packages/ssg/src/index.ts'),
            '@sigx/ssg-theme-daisyui': resolve(__dirname, 'packages/ssg-theme-daisyui/src/index.ts'),
            '@sigx/ssr-islands': resolve(__dirname, 'packages/ssr-islands/src/index.ts')
        }
    }
});
