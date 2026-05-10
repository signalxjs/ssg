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
        exclude: ['**/node_modules/**'],
        globals: true,
        passWithNoTests: true,
    },
    resolve: {
        alias: {
            '@sigx/ssg': resolve(__dirname, 'packages/ssg/src/index.ts'),
            '@sigx/ssg-theme-daisyui': resolve(__dirname, 'packages/ssg-theme-daisyui/src/index.ts')
        }
    }
});
